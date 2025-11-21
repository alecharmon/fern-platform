import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api";
import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import * as path from "path";

export class FdrLambdaDocsDeployStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        version: string,
        environmentType: EnvironmentType,
        environmentInfo: EnvironmentInfo,
        props?: StackProps
    ) {
        super(scope, id, props);

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

        // Create Lambda function (no VPC configuration)
        const functionName = `fdr-lambda-docs-${environmentType.toLowerCase()}`;

        const lambdaFunction = new lambda.Function(this, "fdr-lambda-docs-function", {
            functionName,
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: "index.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "../../fdr-lambda-docs/dist")),
            timeout: Duration.seconds(30),
            memorySize: 512,
            logGroup,
            environment: {
                NODE_ENV: "production",
                ENVIRONMENT_TYPE: environmentType,
                OPENAI_API_KEY: getEnvironmentVariableOrThrow("OPENAI_API_KEY"),
                DOCS_DB_SECRET_ID: process.env.DOCS_DB_SECRET_ID ?? ""
            }
        });

        if (process.env.DOCS_DB_SECRET_ID) {
            const dbSecret = Secret.fromSecretNameV2(this, "DocsDbSecret", process.env.DOCS_DB_SECRET_ID);
            dbSecret.grantRead(lambdaFunction);
        }

        // Create API Gateway with custom domain
        const apiName = `fdr-lambda-docs-${environmentType.toLowerCase()}`;

        const api = new apigateway.RestApi(this, "fdr-lambda-docs-api", {
            restApiName: apiName,
            description: `FDR Lambda Docs API for ${environmentType}`,
            deployOptions: {
                stageName: environmentType.toLowerCase(),
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true
            }
        });

        // Create custom domain name for API Gateway
        const customDomain = new apigateway.DomainName(this, "fdr-lambda-docs-domain", {
            domainName: getLambdaDomainName(environmentType, environmentInfo),
            certificate
        });

        // Map the custom domain to the API Gateway
        new apigateway.BasePathMapping(this, "fdr-lambda-docs-base-path-mapping", {
            domainName: customDomain,
            restApi: api,
            stage: api.deploymentStage
        });

        // Create Route53 record for custom domain
        new ARecord(this, "fdr-lambda-docs-domain-record", {
            zone: hostedZone,
            target: RecordTarget.fromAlias(new targets.ApiGatewayDomain(customDomain)),
            recordName: getLambdaDomainName(environmentType, environmentInfo)
        });

        new CfnOutput(this, "CustomDomainUrl", {
            value: `https://${getLambdaDomainName(environmentType, environmentInfo)}`,
            description: "Custom Domain URL"
        });

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
    }
}

function getLambdaDomainName(environmentType: EnvironmentType, environmentInfo: EnvironmentInfo) {
    if (environmentType === EnvironmentType.Prod) {
        return "docs-ai" + "." + environmentInfo.route53Info.hostedZoneName;
    }
    return "docs-ai" + "-" + environmentType.toLowerCase() + "." + environmentInfo.route53Info.hostedZoneName;
}

function getEnvironmentVariableOrThrow(environmentVariable: string): string {
    const value = process.env[environmentVariable];
    if (value == null) {
        throw new Error(`Environment variable ${environmentVariable} not found`);
    }
    return value;
}
