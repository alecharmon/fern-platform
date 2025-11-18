import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
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
            retention: RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.DESTROY
        });

        const certificate = Certificate.fromCertificateArn(
            this,
            "certificate",
            environmentInfo.route53Info.certificateArn
        );

        const hostedZone = HostedZone.fromHostedZoneAttributes(this, "zoneId", {
            hostedZoneId: environmentInfo.route53Info.hostedZoneId,
            zoneName: environmentInfo.route53Info.hostedZoneName
        });

        // Use unique function name for preview deployments
        const functionName = previewOptions?.isPreview
            ? `${lambdaName}-preview-${previewOptions.prNumber}`
            : `${lambdaName}-${environmentType.toLowerCase()}`;

        const lambdaFunction = new lambda.DockerImageFunction(this, `${lambdaName}-lambda-function`, {
            functionName,
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, `../../fai-lambda`), {
                file: `${lambdaName}/Dockerfile`
            }),
            timeout: Duration.minutes(15), // Max timeout for Lambda
            memorySize: 2048, // 2GB for chat/AI workloads
            logGroup,
            environment: {
                ENVIRONMENT_TYPE: environmentType,
                ANTHROPIC_API_KEY: getEnvironmentVariableOrThrow("ANTHROPIC_API_KEY"),
                OPENAI_API_KEY: getEnvironmentVariableOrThrow("OPENAI_API_KEY"),
                COHERE_API_KEY: getEnvironmentVariableOrThrow("COHERE_API_KEY"),
                TURBOPUFFER_API_KEY: getEnvironmentVariableOrThrow("TURBOPUFFER_API_KEY"),
                FERN_TOKEN: getEnvironmentVariableOrThrow("FERN_TOKEN")
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

        const apiName = `${lambdaName}-${environmentType.toLowerCase()}`;

        const api = new apigateway.RestApi(this, `${lambdaName}-api`, {
            restApiName: apiName,
            description: `${lambdaName} API for ${environmentType}`,
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ["Content-Type", "X-Amz-Date", "Authorization", "X-Api-Key", "X-Amz-Security-Token"]
            },
            deployOptions: {
                stageName: environmentType.toLowerCase(),
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true
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

        const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction);

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
