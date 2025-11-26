import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps, Tags } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as appscaling from "aws-cdk-lib/aws-applicationautoscaling";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import type { Construct } from "constructs";
import * as path from "path";

export interface FaiChatStackPreviewOptions {
    isPreview: boolean;
    prNumber: string;
}

export class FaiChatStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        version: string,
        environmentType: EnvironmentType,
        environmentInfo: EnvironmentInfo,
        props?: StackProps,
        previewOptions?: FaiChatStackPreviewOptions
    ) {
        super(scope, id, props);

        const lambdaName = "fai-chat";

        // Use unique log group name for preview deployments
        const logGroupName = previewOptions?.isPreview
            ? `/aws/lambda/${lambdaName}-preview-${previewOptions.prNumber}`
            : `/aws/lambda/${lambdaName}-${environmentType.toLowerCase()}`;

        const logGroup = new LogGroup(this, "log-group", {
            logGroupName,
            retention: environmentType === EnvironmentType.Prod ? RetentionDays.ONE_YEAR : RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY
        });

        // Add tags
        Tags.of(logGroup).add("Environment", environmentType.toLowerCase());
        if (environmentType !== EnvironmentType.Prod) {
            Tags.of(logGroup).add("VantaNonProd", "true");
        }

        const certificate = Certificate.fromCertificateArn(
            this,
            "certificate",
            environmentInfo.route53Info.certificateArn
        );

        const hostedZone = HostedZone.fromHostedZoneAttributes(this, "zoneId", {
            hostedZoneId: environmentInfo.route53Info.hostedZoneId,
            zoneName: environmentInfo.route53Info.hostedZoneName
        });

        // Import existing shared VPC (avoids VPC/IGW quota limits and NAT costs)
        const vpc = ec2.Vpc.fromLookup(this, "vpc", {
            vpcId: environmentInfo.vpcId
        });

        // Security group for Lambda function
        const lambdaSecurityGroup = new ec2.SecurityGroup(this, "lambda-security-group", {
            vpc,
            description: `Security group for ${lambdaName} Lambda function`,
            allowAllOutbound: true
        });

        // Use unique function name for preview deployments
        const functionName = previewOptions?.isPreview
            ? `${lambdaName}-preview-${previewOptions.prNumber}`
            : `${lambdaName}-${environmentType.toLowerCase()}`;

        // Environment-aware configuration
        const isProd = environmentType === EnvironmentType.Prod;
        const reservedConcurrency = isProd ? 30 : 20;

        const lambdaFunction = new lambda.DockerImageFunction(this, `${lambdaName}-lambda-function`, {
            functionName,
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, `../../fai-lambda`), {
                file: `${lambdaName}/Dockerfile`
            }),
            timeout: Duration.minutes(15),
            memorySize: 768,
            reservedConcurrentExecutions: reservedConcurrency,
            logGroup,
            vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            },
            securityGroups: [lambdaSecurityGroup],
            environment: {
                ENVIRONMENT_TYPE: environmentType,
                ANTHROPIC_API_KEY: getEnvironmentVariableOrThrow("ANTHROPIC_API_KEY"),
                OPENAI_API_KEY: getEnvironmentVariableOrThrow("OPENAI_API_KEY"),
                COHERE_API_KEY: getEnvironmentVariableOrThrow("COHERE_API_KEY"),
                TURBOPUFFER_API_KEY: getEnvironmentVariableOrThrow("TURBOPUFFER_API_KEY"),
                FERN_TOKEN: getEnvironmentVariableOrThrow("FERN_TOKEN"),
                POSTHOG_API_KEY: getEnvironmentVariableOrThrow("POSTHOG_API_KEY")
            }
        });

        // Grant Lambda permission to invoke other services if needed
        lambdaFunction.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["lambda:InvokeFunction"],
                resources: [`arn:aws:lambda:us-east-1:985111089818:function:fai-code-indexing-*`]
            })
        );

        // Grant Lambda permission to use AWS Bedrock Converse API
        lambdaFunction.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
                resources: ["*"]
            })
        );

        // Create alias for provisioned concurrency (only for prod, not dev or preview)
        const alias =
            isProd && !previewOptions?.isPreview
                ? new lambda.Alias(this, `${lambdaName}-alias`, {
                      aliasName: "live",
                      version: lambdaFunction.currentVersion,
                      provisionedConcurrentExecutions: 3
                  })
                : null;

        // Auto-scaling for provisioned concurrency (only for prod)
        if (alias) {
            const scalingTarget = new appscaling.ScalableTarget(this, `${lambdaName}-scaling-target`, {
                serviceNamespace: appscaling.ServiceNamespace.LAMBDA,
                resourceId: `function:${lambdaFunction.functionName}:live`,
                scalableDimension: "lambda:function:ProvisionedConcurrency",
                minCapacity: 2,
                maxCapacity: 10
            });
            scalingTarget.node.addDependency(alias);

            scalingTarget.scaleToTrackMetric(`${lambdaName}-scaling-policy`, {
                targetValue: 0.7,
                predefinedMetric: appscaling.PredefinedMetric.LAMBDA_PROVISIONED_CONCURRENCY_UTILIZATION,
                scaleInCooldown: Duration.minutes(5),
                scaleOutCooldown: Duration.seconds(60)
            });
        }

        const apiName = `${lambdaName}-${environmentType.toLowerCase()}`;

        const api = new apigateway.RestApi(this, `${lambdaName}-api`, {
            restApiName: apiName,
            description: `${lambdaName} API for ${environmentType}`,
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: apigateway.Cors.DEFAULT_HEADERS
            },
            deployOptions: {
                stageName: environmentType.toLowerCase(),
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                throttlingRateLimit: isProd ? 30 : 20,
                throttlingBurstLimit: isProd ? 60 : 40
            }
        });

        // Only create custom domain for non-preview deployments
        if (!previewOptions?.isPreview) {
            const customDomain = new apigateway.DomainName(this, `${lambdaName}-domain`, {
                domainName: getLambdaDomainName(lambdaName, environmentType, environmentInfo),
                certificate
            });

            new apigateway.BasePathMapping(this, `${lambdaName}-base-path-mapping`, {
                domainName: customDomain,
                restApi: api,
                stage: api.deploymentStage
            });

            new ARecord(this, `${lambdaName}-domain-record`, {
                zone: hostedZone,
                target: RecordTarget.fromAlias(new targets.ApiGatewayDomain(customDomain)),
                recordName: getLambdaDomainName(lambdaName, environmentType, environmentInfo)
            });

            new CfnOutput(this, "CustomDomainUrl", {
                value: `https://${getLambdaDomainName(lambdaName, environmentType, environmentInfo)}`,
                description: "Custom Domain URL"
            });
        }

        // Use alias for non-preview deployments (routes to provisioned concurrency)
        const lambdaIntegration = new apigateway.LambdaIntegration(alias ?? lambdaFunction);

        // Proxy all requests to Lambda
        api.root.addProxy({
            defaultIntegration: lambdaIntegration,
            anyMethod: true
        });

        // Add explicit health endpoint
        const health = api.root.addResource("health");
        health.addMethod("GET", lambdaIntegration);

        const apiUrlWithoutTrailingSlash = api.url.replace(/\/$/, "");

        // Output the API Gateway URL (always available)
        new CfnOutput(this, "ApiUrl", {
            value: apiUrlWithoutTrailingSlash,
            description: "API Gateway URL",
            exportName: previewOptions?.isPreview ? `fai-chat-preview-${previewOptions.prNumber}-url` : undefined
        });

        // For preview deployments, also output as PreviewUrl for easy access
        if (previewOptions?.isPreview) {
            new CfnOutput(this, "PreviewUrl", {
                value: apiUrlWithoutTrailingSlash,
                description: "Preview URL for this PR"
            });
        }

        new CfnOutput(this, "LambdaFunctionName", {
            value: lambdaFunction.functionName,
            description: "Lambda Function Name"
        });

        // CloudWatch alarms (only for non-preview deployments)
        if (!previewOptions?.isPreview) {
            new cloudwatch.Alarm(this, "throttle-alarm", {
                metric: lambdaFunction.metricThrottles(),
                threshold: 1,
                evaluationPeriods: 3,
                alarmDescription: "Lambda throttling - capacity issue"
            });

            // Alert at 80% of reserved concurrency
            const concurrencyAlarmThreshold = Math.floor(reservedConcurrency * 0.8);
            new cloudwatch.Alarm(this, "concurrency-alarm", {
                metric: lambdaFunction.metric("ConcurrentExecutions", {
                    statistic: "Maximum",
                    period: Duration.minutes(1)
                }),
                threshold: concurrencyAlarmThreshold,
                evaluationPeriods: 3,
                alarmDescription: `Approaching concurrency limit (${concurrencyAlarmThreshold}/${reservedConcurrency})`
            });
        }
    }
}

function getLambdaDomainName(lambdaName: string, environmentType: EnvironmentType, environmentInfo: EnvironmentInfo) {
    if (environmentType === EnvironmentType.Prod) {
        return lambdaName + "." + environmentInfo.route53Info.hostedZoneName;
    }
    return lambdaName + "-" + environmentType.toLowerCase() + "." + environmentInfo.route53Info.hostedZoneName;
}

function getEnvironmentVariableOrThrow(environmentVariable: string): string {
    const value = process.env[environmentVariable];
    if (value == null) {
        throw new Error(`Environment variable ${environmentVariable} is not defined`);
    }
    return value;
}
