import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as efs from "aws-cdk-lib/aws-efs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import type { Construct } from "constructs";
import * as path from "path";

export class FaiScribeStack extends Stack {
    public readonly vpc: ec2.Vpc;

    constructor(
        scope: Construct,
        id: string,
        version: string,
        environmentType: EnvironmentType,
        environmentInfo: EnvironmentInfo,
        props?: StackProps
    ) {
        super(scope, id, props);

        const lambdaName = "fai-scribe";

        const logGroup = new LogGroup(this, "log-group", {
            logGroupName: `/aws/lambda/${lambdaName}-${environmentType.toLowerCase()}`,
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

        this.vpc = new ec2.Vpc(this, `${lambdaName}-vpc`, {
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: "public",
                    subnetType: ec2.SubnetType.PUBLIC
                },
                {
                    cidrMask: 24,
                    name: "private",
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
                }
            ]
        });

        const efsSecurityGroup = new ec2.SecurityGroup(this, "efs-security-group", {
            vpc: this.vpc,
            description: "Security group for EFS file system",
            allowAllOutbound: false
        });

        const lambdaSecurityGroup = new ec2.SecurityGroup(this, "lambda-security-group", {
            vpc: this.vpc,
            description: `Security group for ${lambdaName} Lambda function`,
            allowAllOutbound: true
        });

        efsSecurityGroup.addIngressRule(lambdaSecurityGroup, ec2.Port.tcp(2049), "Allow NFS access from Lambda");

        const fileSystem = new efs.FileSystem(this, "claude-session-storage", {
            vpc: this.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            },
            securityGroup: efsSecurityGroup,
            encrypted: true,
            lifecyclePolicy: efs.LifecyclePolicy.AFTER_7_DAYS,
            performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
            throughputMode: efs.ThroughputMode.BURSTING,
            removalPolicy: RemovalPolicy.RETAIN
        });

        const accessPoint = fileSystem.addAccessPoint("lambda-access-point", {
            path: "/claude-sessions",
            createAcl: {
                ownerUid: "1001",
                ownerGid: "1001",
                permissions: "755"
            },
            posixUser: {
                uid: "1001",
                gid: "1001"
            }
        });

        const functionName = `${lambdaName}-${environmentType.toLowerCase()}`;

        const lambdaFunction = new lambda.DockerImageFunction(this, `${lambdaName}-lambda-function`, {
            functionName,
            code: lambda.DockerImageCode.fromImageAsset(path.join(__dirname, `../../fai-lambda`), {
                file: `${lambdaName}/Dockerfile`
            }),
            timeout: Duration.minutes(15),
            memorySize: 512,
            logGroup,
            vpc: this.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
            },
            securityGroups: [lambdaSecurityGroup],
            environment: {
                ENVIRONMENT_TYPE: environmentType,
                FERN_TOKEN: getEnvironmentVariableOrThrow("FERN_TOKEN"),
                GITHUB_TOKEN: getEnvironmentVariableOrThrow("SCRIBE_GITHUB_TOKEN"),
                ANTHROPIC_API_KEY: getEnvironmentVariableOrThrow("ANTHROPIC_API_KEY"),
                HOME: "/mnt/efs"
            },
            filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, "/mnt/efs")
        });

        const apiName = `${lambdaName}-${environmentType.toLowerCase()}`;

        const api = new apigateway.RestApi(this, `${lambdaName}-api`, {
            restApiName: apiName,
            description: `${lambdaName} API for ${environmentType}`,
            deployOptions: {
                stageName: environmentType.toLowerCase(),
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true
            }
        });

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

        const lambdaIntegration = new apigateway.LambdaIntegration(lambdaFunction);

        api.root.addProxy({
            defaultIntegration: lambdaIntegration,
            anyMethod: true
        });

        const health = api.root.addResource("health");
        health.addMethod("GET", lambdaIntegration);

        const apiUrlWithoutTrailingSlash = api.url.replace(/\/$/, "");

        new CfnOutput(this, "ApiUrl", {
            value: apiUrlWithoutTrailingSlash,
            description: "API Gateway URL"
        });

        new CfnOutput(this, "CustomDomainUrl", {
            value: `https://${getLambdaDomainName(lambdaName, environmentType, environmentInfo)}`,
            description: "Custom Domain URL"
        });

        new CfnOutput(this, "LambdaFunctionName", {
            value: lambdaFunction.functionName,
            description: "Lambda Function Name"
        });

        new CfnOutput(this, "EfsFileSystemId", {
            value: fileSystem.fileSystemId,
            description: "EFS File System ID"
        });

        new CfnOutput(this, "EfsAccessPointId", {
            value: accessPoint.accessPointId,
            description: "EFS Access Point ID"
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
        throw new Error(`Environment variable ${environmentVariable} not found`);
    }
    return value;
}
