import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as efs from "aws-cdk-lib/aws-efs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import type { Construct } from "constructs";
import * as path from "path";

export class FaiLambdaDeployStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        version: string,
        environmentType: EnvironmentType,
        environmentInfo: EnvironmentInfo,
        props?: StackProps
    ) {
        super(scope, id, props);

        // Create a dedicated log group for this Lambda function
        const logGroup = new LogGroup(this, "log-group", {
            logGroupName: `/aws/lambda/fai-scribe-${environmentType.toLowerCase()}`,
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

        // Import existing VPC using environmentInfo
        const vpc = ec2.Vpc.fromLookup(this, "vpc", {
            vpcId: environmentInfo.vpcId
        });

        // Create security group for Lambda
        const lambdaSecurityGroup = new ec2.SecurityGroup(this, "lambda-security-group", {
            vpc,
            description: "Security group for FAI Scribe Lambda function",
            allowAllOutbound: true
        });

        // Create or reference EFS file system
        // Note: In production, you may want to reference an existing EFS file system
        const efsSecurityGroup = new ec2.SecurityGroup(this, "efs-security-group", {
            vpc,
            description: "Security group for EFS",
            allowAllOutbound: true
        });

        // Allow Lambda to access EFS on NFS port
        efsSecurityGroup.addIngressRule(lambdaSecurityGroup, ec2.Port.tcp(2049), "Allow NFS access from Lambda");

        // Get or create EFS file system ID from environment variable
        const efsFileSystemId = process.env["EFS_FILE_SYSTEM_ID"];
        let fileSystem: efs.IFileSystem;

        if (efsFileSystemId) {
            // Reference existing EFS file system
            fileSystem = efs.FileSystem.fromFileSystemAttributes(this, "efs-file-system", {
                fileSystemId: efsFileSystemId,
                securityGroup: efsSecurityGroup
            });
        } else {
            // Create new EFS file system
            fileSystem = new efs.FileSystem(this, "efs-file-system", {
                vpc,
                lifecyclePolicy: efs.LifecyclePolicy.AFTER_14_DAYS,
                performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
                throughputMode: efs.ThroughputMode.BURSTING,
                securityGroup: efsSecurityGroup,
                vpcSubnets: {
                    subnetType: ec2.SubnetType.PUBLIC
                }
            });
        }

        // Create EFS access point
        const accessPoint = new efs.AccessPoint(this, "efs-access-point", {
            fileSystem,
            path: "/lambda",
            posixUser: {
                uid: "1001",
                gid: "1001"
            },
            createAcl: {
                ownerUid: "1001",
                ownerGid: "1001",
                permissions: "755"
            }
        });

        // Create Lambda function
        const functionName = `fai-scribe-${environmentType.toLowerCase()}`;

        const lambdaFunction = new lambda.Function(this, "fai-scribe-lambda-function", {
            functionName,
            runtime: lambda.Runtime.PYTHON_3_12,
            handler: "handler.handler",
            code: lambda.Code.fromAsset(path.join(__dirname, "../../fai-lambda/src")),
            timeout: Duration.seconds(30),
            memorySize: 512,
            logGroup,
            vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC
            },
            allowPublicSubnet: true,
            securityGroups: [lambdaSecurityGroup],
            filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, "/mnt/efs"),
            environment: {
                ENVIRONMENT_TYPE: environmentType,
                FERN_TOKEN: getEnvironmentVariableOrThrow("FERN_TOKEN"),
                EFS_MOUNT_PATH: "/mnt/efs"
            }
        });

        // Grant Lambda permissions to access EFS
        lambdaFunction.addToRolePolicy(
            new iam.PolicyStatement({
                actions: [
                    "elasticfilesystem:ClientMount",
                    "elasticfilesystem:ClientWrite",
                    "elasticfilesystem:ClientRootAccess"
                ],
                resources: [fileSystem.fileSystemArn]
            })
        );

        // Create API Gateway with custom domain
        const apiName = `fai-scribe-${environmentType.toLowerCase()}`;

        const api = new apigateway.RestApi(this, "fai-scribe-api", {
            restApiName: apiName,
            description: `FAI Scribe API for ${environmentType}`,
            deployOptions: {
                stageName: environmentType.toLowerCase(),
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true
            }
        });

        // Create custom domain name for API Gateway
        const customDomain = new apigateway.DomainName(this, "fai-scribe-domain", {
            domainName: getLambdaDomainName(environmentType, environmentInfo),
            certificate
        });

        // Map the custom domain to the API Gateway
        new apigateway.BasePathMapping(this, "fai-scribe-base-path-mapping", {
            domainName: customDomain,
            restApi: api,
            stage: api.deploymentStage
        });

        // Create Route53 record for custom domain
        new ARecord(this, "fai-scribe-domain-record", {
            zone: hostedZone,
            target: RecordTarget.fromAlias(new targets.ApiGatewayDomain(customDomain)),
            recordName: getLambdaDomainName(environmentType, environmentInfo)
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

        new CfnOutput(this, "CustomDomainUrl", {
            value: `https://${getLambdaDomainName(environmentType, environmentInfo)}`,
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
    }
}

function getLambdaDomainName(environmentType: EnvironmentType, environmentInfo: EnvironmentInfo) {
    if (environmentType === EnvironmentType.Prod) {
        return "fai-scribe" + "." + environmentInfo.route53Info.hostedZoneName;
    }
    return "fai-scribe" + "-" + environmentType.toLowerCase() + "." + environmentInfo.route53Info.hostedZoneName;
}

function getEnvironmentVariableOrThrow(environmentVariable: string): string {
    const value = process.env[environmentVariable];
    if (value == null) {
        throw new Error(`Environment variable ${environmentVariable} not found`);
    }
    return value;
}
