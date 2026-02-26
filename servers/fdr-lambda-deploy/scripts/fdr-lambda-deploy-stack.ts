import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api";
import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import type { Construct } from "constructs";
import * as path from "path";

interface FdrLambdaDeployOptions {
    isPreview?: boolean;
    prNumber?: string;
}

export class FdrLambdaDeployStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        version: string,
        environmentType: EnvironmentType,
        environmentInfo: EnvironmentInfo,
        rdsProxySecurityGroupId: string,
        props?: StackProps,
        options?: FdrLambdaDeployOptions
    ) {
        super(scope, id, props);

        const isPreview = options?.isPreview ?? false;
        const prNumber = options?.prNumber;

        const logGroup = LogGroup.fromLogGroupName(this, "log-group", environmentInfo.logGroupInfo.logGroupName);

        const certificate = Certificate.fromCertificateArn(
            this,
            "certificate",
            environmentInfo.route53Info.certificateArn
        );

        const hostedZone = HostedZone.fromHostedZoneAttributes(this, "zoneId", {
            hostedZoneId: environmentInfo.route53Info.hostedZoneId,
            zoneName: environmentInfo.route53Info.hostedZoneName
        });

        // Import existing VPC using environmentInfo like fdr-deploy does
        const vpc = ec2.Vpc.fromLookup(this, "vpc", {
            vpcId: environmentInfo.vpcId
        });

        // Note: S3 VPC Gateway Endpoint should already exist in the VPC
        // If needed, it can be looked up using ec2.GatewayVpcEndpoint.fromGatewayVpcEndpointId()
        // We don't create it here to avoid conflicts with existing infrastructure

        // Create security group for Lambda
        const lambdaSecurityGroup = new ec2.SecurityGroup(this, "lambda-security-group", {
            vpc,
            description: "Security group for FDR Lambda function",
            allowAllOutbound: true
        });

        // Import the existing RDS Proxy security group
        const rdsProxySecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
            this,
            "rds-proxy-security-group",
            rdsProxySecurityGroupId,
            {
                mutable: true
            }
        );

        // Allow RDS Proxy security group to accept inbound connections from Lambda
        rdsProxySecurityGroup.addIngressRule(
            lambdaSecurityGroup,
            ec2.Port.tcp(5432),
            "Allow inbound PostgreSQL traffic from Lambda"
        );

        // Create Lambda function
        const functionName = isPreview
            ? `fdr-lambda-preview-${prNumber}`
            : `fdr-lambda-${environmentType.toLowerCase()}`;

        const lambdaFunction = new lambda.Function(this, "fdr-lambda-function", {
            functionName,
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "../../fdr-lambda/dist")),
            timeout: Duration.seconds(30),
            memorySize: 512,
            logGroup,
            vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC
            },
            allowPublicSubnet: true,
            securityGroups: [lambdaSecurityGroup],
            environment: {
                NODE_ENV: "production",
                ENVIRONMENT_TYPE: environmentType,
                DATABASE_URL: getEnvironmentVariableOrThrow("DATABASE_URL"),
                VENUS_URL: getEnvironmentVariableOrThrow("VENUS_URL"),
                PUBLIC_DOCS_CDN_URL: getEnvironmentVariableOrThrow("PUBLIC_DOCS_CDN_URL"),
                PUBLIC_DOCS_S3_BUCKET_NAME: getEnvironmentVariableOrThrow("PUBLIC_DOCS_S3_BUCKET_NAME"),
                PUBLIC_DOCS_S3_BUCKET_REGION: getEnvironmentVariableOrDefault(
                    "PUBLIC_DOCS_S3_BUCKET_REGION",
                    "us-east-1"
                ),
                PRIVATE_DOCS_S3_BUCKET_NAME: getEnvironmentVariableOrThrow("PRIVATE_DOCS_S3_BUCKET_NAME"),
                PRIVATE_DOCS_S3_BUCKET_REGION: getEnvironmentVariableOrDefault(
                    "PRIVATE_DOCS_S3_BUCKET_REGION",
                    "us-east-1"
                ),
                DB_DOCS_DEFINITION_BUCKET_NAME: getEnvironmentVariableOrThrow("DB_DOCS_DEFINITION_BUCKET_NAME"),
                DB_DOCS_DEFINITION_BUCKET_REGION: getEnvironmentVariableOrDefault(
                    "DB_DOCS_DEFINITION_BUCKET_REGION",
                    "us-east-1"
                ),
                JWT_SECRET_KEY: getEnvironmentVariableOrThrow("JWT_SECRET_KEY"),
                ...(isPreview && { IS_PREVIEW: "true", PR_NUMBER: prNumber! })
            }
        });

        // Grant Lambda permissions to access S3 buckets
        const publicBucketName = getEnvironmentVariableOrThrow("PUBLIC_DOCS_S3_BUCKET_NAME");
        const privateBucketName = getEnvironmentVariableOrThrow("PRIVATE_DOCS_S3_BUCKET_NAME");
        const dbDocsDefinitionBucketName = getEnvironmentVariableOrThrow("DB_DOCS_DEFINITION_BUCKET_NAME");

        // Grant permission to read and delete objects from S3 buckets
        lambdaFunction.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["s3:GetObject", "s3:DeleteObject"],
                resources: [
                    `arn:aws:s3:::${publicBucketName}/*`,
                    `arn:aws:s3:::${privateBucketName}/*`,
                    `arn:aws:s3:::${dbDocsDefinitionBucketName}/*`
                ]
            })
        );

        // Grant permission to list buckets (needed by S3 SDK for error handling)
        lambdaFunction.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["s3:ListBucket"],
                resources: [
                    `arn:aws:s3:::${publicBucketName}`,
                    `arn:aws:s3:::${privateBucketName}`,
                    `arn:aws:s3:::${dbDocsDefinitionBucketName}`
                ]
            })
        );

        // Grant permission to invoke Bedrock models for AI example enhancement
        lambdaFunction.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ["bedrock:InvokeModel"],
                resources: ["arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307"]
            })
        );

        // Create API Gateway with custom domain
        const apiName = isPreview ? `fdr-lambda-preview-${prNumber}` : `fdr-lambda-${environmentType.toLowerCase()}`;

        const api = new apigateway.RestApi(this, "fdr-lambda-api", {
            restApiName: apiName,
            description: isPreview
                ? `FDR Lambda API Preview for PR #${prNumber}`
                : `FDR Lambda API for ${environmentType}`,
            deployOptions: {
                stageName: isPreview ? `preview-${prNumber}` : environmentType.toLowerCase(),
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true
            }
        });

        // Only create custom domain for non-preview deployments
        if (!isPreview) {
            // Create custom domain name for API Gateway
            const customDomain = new apigateway.DomainName(this, "fdr-lambda-domain", {
                domainName: getLambdaDomainName(environmentType, environmentInfo),
                certificate
            });

            // Map the custom domain to the API Gateway
            new apigateway.BasePathMapping(this, "fdr-lambda-base-path-mapping", {
                domainName: customDomain,
                restApi: api,
                stage: api.deploymentStage
            });

            // Create Route53 record for custom domain
            new ARecord(this, "fdr-lambda-domain-record", {
                zone: hostedZone,
                target: RecordTarget.fromAlias(new targets.ApiGatewayDomain(customDomain)),
                recordName: getLambdaDomainName(environmentType, environmentInfo)
            });

            new CfnOutput(this, "CustomDomainUrl", {
                value: `https://${getLambdaDomainName(environmentType, environmentInfo)}`,
                description: "Custom Domain URL"
            });
        }

        // Add Lambda integration
        const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction);

        // Add proxy resource
        api.root.addProxy({
            defaultIntegration: lambdaIntegration,
            anyMethod: true
        });

        // Add health endpoint
        const health = api.root.addResource("health");
        health.addMethod("GET", lambdaIntegration);

        // Output the API URL (remove trailing slash to avoid double slashes)
        const apiUrlWithoutTrailingSlash = api.url.replace(/\/$/, "");

        new CfnOutput(this, "ApiUrl", {
            value: apiUrlWithoutTrailingSlash,
            description: "API Gateway URL"
        });

        new CfnOutput(this, "LambdaFunctionName", {
            value: lambdaFunction.functionName,
            description: "Lambda Function Name"
        });

        if (isPreview) {
            new CfnOutput(this, "PreviewUrl", {
                value: apiUrlWithoutTrailingSlash,
                description: `Preview URL for PR #${prNumber}`
            });
        }
    }
}

function getLambdaDomainName(environmentType: EnvironmentType, environmentInfo: EnvironmentInfo) {
    if (environmentType === EnvironmentType.Prod) {
        return "registry-v2" + "." + environmentInfo.route53Info.hostedZoneName;
    }
    return "registry-v2" + "-" + environmentType.toLowerCase() + "." + environmentInfo.route53Info.hostedZoneName;
}

function getEnvironmentVariableOrThrow(environmentVariable: string): string {
    const value = process.env[environmentVariable];
    if (value == null) {
        throw new Error(`Environment variable ${environmentVariable} not found`);
    }
    return value;
}

function getEnvironmentVariableOrDefault(environmentVariable: string, defaultValue: string): string {
    return process.env[environmentVariable] ?? defaultValue;
}
