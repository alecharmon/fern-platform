import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api/resources/environments";
import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as aws_ec2 from "aws-cdk-lib/aws-ec2";
import { type IVpc, Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import {
    Cluster,
    ContainerImage,
    Ec2TaskDefinition,
    FargateService,
    FargateTaskDefinition,
    type ICluster,
    LogDriver,
    NetworkMode
} from "aws-cdk-lib/aws-ecs";
import * as events from "aws-cdk-lib/aws-events";
import * as events_targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { type ILogGroup, LogGroup } from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

export class FaiReindexingSchedulerStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        version: string,
        environmentType: EnvironmentType,
        environmentInfo: EnvironmentInfo,
        props?: StackProps
    ) {
        super(scope, id, props);

        const vpc = Vpc.fromLookup(this, "vpc", {
            vpcId: environmentInfo.vpcId
        });

        const workerSg = new SecurityGroup(this, "scheduler-sg", {
            securityGroupName: `fai-reindexing-scheduler-${environmentType.toLowerCase()}`,
            vpc,
            allowAllOutbound: true
        });
        workerSg.addIngressRule(Peer.ipv4(environmentInfo.vpcIpv4Cidr), Port.allTcp());

        const cluster = Cluster.fromClusterAttributes(this, "cluster", {
            clusterName: environmentInfo.ecsInfo.clusterName,
            vpc,
            securityGroups: []
        });

        const logGroup = LogGroup.fromLogGroupName(this, "log-group", environmentInfo.logGroupInfo.logGroupName);

        const reindexingDlq = new sqs.Queue(this, "reindexing-scheduler-dlq", {
            queueName: `fai-reindexing-scheduler-dlq-${environmentType.toLowerCase()}`,
            retentionPeriod: Duration.days(14)
        });

        const reindexingQueue = new sqs.Queue(this, "reindexing-scheduler-queue", {
            queueName: `fai-reindexing-scheduler-${environmentType.toLowerCase()}`,
            visibilityTimeout: Duration.seconds(1200),
            retentionPeriod: Duration.days(14),
            deadLetterQueue: {
                queue: reindexingDlq,
                maxReceiveCount: 2
            }
        });

        const { ec2TaskDefinition, fargateTaskDefinition } = this.createDelegatedWorkerTaskDefinitions({
            cluster,
            vpc,
            workerSg,
            logGroup,
            version,
            environmentType
        });

        this.createReindexingSchedulerService({
            cluster,
            vpc,
            workerSg,
            logGroup,
            version,
            environmentType,
            reindexingQueue,
            ec2TaskDefinition,
            fargateTaskDefinition
        });

        this.createOOMRecoveryLambda({
            cluster,
            logGroup,
            reindexingQueue,
            environmentType
        });
    }

    private createDelegatedWorkerTaskDefinitions(props: {
        cluster: ICluster;
        vpc: IVpc;
        workerSg: SecurityGroup;
        logGroup: ILogGroup;
        version: string;
        environmentType: EnvironmentType;
    }): {
        ec2TaskDefinition: Ec2TaskDefinition;
        fargateTaskDefinition: FargateTaskDefinition;
    } {
        const { logGroup, version } = props;

        // Note: We assume the ECS cluster already has EC2 instances registered

        // EC2 Task Definition - supports dynamic memory via task overrides
        // Using BRIDGE network mode so tasks share the EC2 instance's network (and public IP)
        const ec2TaskDefinition = new Ec2TaskDefinition(this, "delegated-worker-ec2-task-def", {
            networkMode: NetworkMode.BRIDGE
        });

        ec2TaskDefinition.addContainer("fai-reindexing-delegated-worker", {
            containerName: "fai-reindexing-delegated-worker",
            image: ContainerImage.fromTarball(`../fai-reindexing-scheduler:${version}.tar`),
            logging: LogDriver.awsLogs({
                logGroup,
                streamPrefix: "fai-reindexing-delegated-worker-ec2"
            }),
            command: ["dist/worker.cjs"],
            // Memory reservation (soft limit for scheduling) - will be overridden dynamically
            memoryReservationMiB: 512,
            // Memory limit (hard limit - task killed if exceeded) - will be overridden dynamically
            memoryLimitMiB: 1024,
            environment: {
                FERN_DOCS_INDEX_NAME: "fern-docs"
            }
        });

        ec2TaskDefinition.taskRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["lambda:InvokeFunction"],
                resources: ["arn:aws:lambda:us-east-1:985111089818:function:fai-code-indexing-*"]
            })
        );

        // Grant S3 read access for docs definitions bucket
        const docsDefBucketName = getDocsDefinitionBucketName(props.environmentType);
        if (docsDefBucketName) {
            ec2TaskDefinition.taskRole.addToPrincipalPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ["s3:GetObject"],
                    resources: [`arn:aws:s3:::${docsDefBucketName}/*`]
                })
            );
        }

        // Fargate Task Definition - fallback with static default
        const fargateTaskDefinition = new FargateTaskDefinition(this, "delegated-worker-fargate-task-def", {
            cpu: 2048,
            memoryLimitMiB: 4096
        });

        fargateTaskDefinition.addContainer("fai-reindexing-delegated-worker", {
            containerName: "fai-reindexing-delegated-worker",
            image: ContainerImage.fromTarball(`../fai-reindexing-scheduler:${version}.tar`),
            logging: LogDriver.awsLogs({
                logGroup,
                streamPrefix: "fai-reindexing-delegated-worker-fargate"
            }),
            command: ["dist/worker.cjs"],
            environment: {
                NODE_OPTIONS: "--max-old-space-size=3584",
                FERN_DOCS_INDEX_NAME: "fern-docs"
            }
        });

        fargateTaskDefinition.taskRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["lambda:InvokeFunction"],
                resources: ["arn:aws:lambda:us-east-1:985111089818:function:fai-code-indexing-*"]
            })
        );

        if (docsDefBucketName) {
            fargateTaskDefinition.taskRole.addToPrincipalPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ["s3:GetObject"],
                    resources: [`arn:aws:s3:::${docsDefBucketName}/*`]
                })
            );
        }

        return { ec2TaskDefinition, fargateTaskDefinition };
    }

    private createReindexingSchedulerService(props: {
        cluster: ICluster;
        vpc: IVpc;
        workerSg: SecurityGroup;
        logGroup: ILogGroup;
        version: string;
        environmentType: EnvironmentType;
        reindexingQueue: sqs.Queue;
        ec2TaskDefinition: Ec2TaskDefinition;
        fargateTaskDefinition: FargateTaskDefinition;
    }): void {
        const {
            cluster,
            vpc,
            workerSg,
            logGroup,
            version,
            environmentType,
            reindexingQueue,
            ec2TaskDefinition,
            fargateTaskDefinition
        } = props;

        const subnets = vpc.selectSubnets({ subnetType: aws_ec2.SubnetType.PUBLIC });
        const subnetIds = subnets.subnetIds.join(",");

        const schedulerTaskDefinition = new FargateTaskDefinition(this, "scheduler-task-def", {
            cpu: 1024,
            memoryLimitMiB: 2048
        });

        schedulerTaskDefinition.addContainer("fai-reindexing-scheduler", {
            containerName: "fai-reindexing-scheduler",
            image: ContainerImage.fromTarball(`../fai-reindexing-scheduler:${version}.tar`),
            logging: LogDriver.awsLogs({
                logGroup,
                streamPrefix: "fai-reindexing-scheduler"
            }),
            environment: {
                NODE_OPTIONS: "--max-old-space-size=1792", // ~87.5% of 2GB
                SQS_QUEUE_URL: reindexingQueue.queueUrl,
                OPENAI_API_KEY: getEnvVarOrThrow("OPENAI_API_KEY"),
                TURBOPUFFER_API_KEY: getEnvVarOrThrow("TURBOPUFFER_API_KEY"),
                FERN_TOKEN: getFernToken(environmentType),
                FAI_ORIGIN: getFaiOrigin(environmentType),
                FDR_ORIGIN: getFdrOrigin(environmentType),
                FDR_LAMBDA_ORIGIN: getFdrLambdaOrigin(environmentType),
                ...(getDocsDefinitionBucketName(environmentType) && {
                    DOCS_DEFINITION_S3_BUCKET_NAME: getDocsDefinitionBucketName(environmentType)!
                }),
                FERN_DOCS_INDEX_NAME: "fern-docs",
                ECS_CLUSTER_NAME: cluster.clusterName,
                ECS_EC2_TASK_DEFINITION: ec2TaskDefinition.taskDefinitionArn,
                ECS_FARGATE_TASK_DEFINITION: fargateTaskDefinition.taskDefinitionArn,
                ECS_CAPACITY_PROVIDER: `fai-reindexing-worker-capacity-provider-${environmentType.toLowerCase()}`,
                ECS_WORKER_CONTAINER_NAME: "fai-reindexing-delegated-worker",
                ECS_SUBNETS: subnetIds,
                ECS_SECURITY_GROUPS: workerSg.securityGroupId,
                ENVIRONMENT: environmentType.toLowerCase(),
                ...(process.env.POSTHOG_API_KEY && {
                    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY
                }),
                ...(getEdgeConfig(environmentType) && {
                    EDGE_CONFIG: getEdgeConfig(environmentType)!
                })
            }
        });

        reindexingQueue.grantConsumeMessages(schedulerTaskDefinition.taskRole);

        reindexingQueue.grantSendMessages(
            iam.User.fromUserArn(this, "vercel-user", "arn:aws:iam::985111089818:user/vercel")
        );

        schedulerTaskDefinition.taskRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["ecs:RunTask"],
                resources: [ec2TaskDefinition.taskDefinitionArn, fargateTaskDefinition.taskDefinitionArn]
            })
        );

        schedulerTaskDefinition.taskRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["iam:PassRole"],
                resources: [
                    ec2TaskDefinition.taskRole.roleArn,
                    ec2TaskDefinition.executionRole!.roleArn,
                    fargateTaskDefinition.taskRole.roleArn,
                    fargateTaskDefinition.executionRole!.roleArn
                ]
            })
        );

        schedulerTaskDefinition.taskRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["ecs:TagResource"],
                resources: [`arn:aws:ecs:${this.region}:${this.account}:task/${cluster.clusterName}/*`]
            })
        );

        // Grant S3 read access for docs definitions bucket (needed for memory calculation)
        const docsDefBucket = getDocsDefinitionBucketName(environmentType);
        if (docsDefBucket) {
            schedulerTaskDefinition.taskRole.addToPrincipalPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ["s3:GetObject"],
                    resources: [`arn:aws:s3:::${docsDefBucket}/*`]
                })
            );
        }

        const service = new FargateService(this, "scheduler-service", {
            serviceName: "fai-reindexing-scheduler",
            cluster,
            taskDefinition: schedulerTaskDefinition,
            desiredCount: 1,
            securityGroups: [workerSg],
            assignPublicIp: true,
            enableECSManagedTags: true,
            enableExecuteCommand: environmentType !== EnvironmentType.Prod
        });

        const scaling = service.autoScaleTaskCount({
            minCapacity: 1,
            maxCapacity: 6
        });

        scaling.scaleToTrackCustomMetric("QueueDepthScaling", {
            metric: reindexingQueue.metricApproximateNumberOfMessagesVisible({
                statistic: "Average",
                period: Duration.seconds(30)
            }),
            targetValue: 5,
            scaleInCooldown: Duration.minutes(5),
            scaleOutCooldown: Duration.seconds(30)
        });
    }

    private createOOMRecoveryLambda(props: {
        cluster: ICluster;
        logGroup: ILogGroup;
        reindexingQueue: sqs.Queue;
        environmentType: EnvironmentType;
    }): void {
        const { cluster, logGroup, reindexingQueue, environmentType } = props;

        // Create Lambda function for OOM recovery
        const oomRecoveryFunction = new lambda.Function(this, "oom-recovery-function", {
            functionName: `fai-reindexing-oom-recovery-${environmentType.toLowerCase()}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: "oom-recovery-handler.handler",
            code: lambda.Code.fromAsset("../dist-lambda"),
            timeout: Duration.seconds(30),
            memorySize: 256,
            environment: {
                SQS_QUEUE_URL: reindexingQueue.queueUrl,
                FAI_ORIGIN: getFaiOrigin(environmentType),
                FERN_TOKEN: getFernToken(environmentType)
            },
            logGroup
        });

        // Grant permissions to Lambda
        reindexingQueue.grantSendMessages(oomRecoveryFunction);

        // Grant ECS permissions to describe tasks and read tags
        oomRecoveryFunction.addToRolePolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["ecs:DescribeTasks", "ecs:ListTagsForResource"],
                resources: ["*"]
            })
        );

        // Create EventBridge rule to trigger Lambda on ECS task state changes
        const rule = new events.Rule(this, "oom-recovery-rule", {
            ruleName: `fai-reindexing-oom-recovery-${environmentType.toLowerCase()}`,
            description: "Detects OOM failures in reindexing worker tasks and triggers recovery",
            eventPattern: {
                source: ["aws.ecs"],
                detailType: ["ECS Task State Change"],
                detail: {
                    clusterArn: [cluster.clusterArn],
                    lastStatus: ["STOPPED"]
                    // Note: Tag filtering doesn't work - ECS task tags are not included in EventBridge events
                    // The Lambda function will filter by checking tags in the event detail
                }
            }
        });

        // Add Lambda as target
        rule.addTarget(new events_targets.LambdaFunction(oomRecoveryFunction));
    }
}

function getEnvVarOrThrow(envVarName: string): string {
    const val = process.env[envVarName];
    if (val != null) {
        return val;
    }
    throw Error("Expected environment variable to be defined: " + envVarName);
}

function getFaiOrigin(environmentType: EnvironmentType): string {
    if (environmentType === EnvironmentType.Dev2) {
        return "https://fai-dev2.buildwithfern.com";
    }
    return "https://fai.buildwithfern.com";
}

function getFdrOrigin(environmentType: EnvironmentType): string {
    if (environmentType === EnvironmentType.Dev2) {
        return "https://registry-dev2.buildwithfern.com";
    }
    return "https://registry.buildwithfern.com";
}

function getFdrLambdaOrigin(environmentType: EnvironmentType): string {
    if (environmentType === EnvironmentType.Dev2) {
        return "https://registry-v2-dev2.buildwithfern.com";
    }
    return "https://registry-v2.buildwithfern.com";
}

/**
 * Returns the FERN_TOKEN for the given environment.
 *
 * CDK synthesizes all stacks even when only one is being deployed.
 * DEPLOY_ENVIRONMENT tells us which stack is the actual deploy target:
 *   - If this stack IS the target → error if the token is missing (misconfiguration)
 *   - If this stack is NOT the target → warn and use a placeholder (synth-only)
 */
function getFernToken(environmentType: EnvironmentType): string {
    const deployTarget = process.env.DEPLOY_ENVIRONMENT?.toLowerCase();

    if (environmentType === EnvironmentType.Dev2) {
        const token = process.env.DEV_FERN_TOKEN;
        if (!token) {
            if (deployTarget === "dev2") {
                throw new Error("DEV_FERN_TOKEN is required when deploying to dev2");
            }
            // biome-ignore lint/suspicious/noConsole: intentional warning for CDK deploy diagnostics
            console.warn(
                "WARNING: DEV_FERN_TOKEN is not set. Dev2 stack will use a placeholder token (non-target stack)."
            );
            return "PLACEHOLDER_DEV_FERN_TOKEN";
        }
        return token;
    }
    const token = process.env.FERN_TOKEN;
    if (!token) {
        if (deployTarget === "prod") {
            throw new Error("FERN_TOKEN is required when deploying to prod");
        }
        // biome-ignore lint/suspicious/noConsole: intentional warning for CDK deploy diagnostics
        console.warn("WARNING: FERN_TOKEN is not set. Prod stack will use a placeholder token (non-target stack).");
        return "PLACEHOLDER_FERN_TOKEN";
    }
    return token;
}

function getEdgeConfig(environmentType: EnvironmentType): string | undefined {
    const deployTarget = process.env.DEPLOY_ENVIRONMENT?.toLowerCase();

    if (environmentType === EnvironmentType.Dev2) {
        const config = process.env.DEV_EDGE_CONFIG;
        if (!config && deployTarget === "dev2") {
            // biome-ignore lint/suspicious/noConsole: intentional warning for CDK deploy diagnostics
            console.warn("WARNING: DEV_EDGE_CONFIG is not set for dev2 deploy. Auth config lookups will not work.");
        }
        return config;
    }
    return process.env.EDGE_CONFIG;
}

function getDocsDefinitionBucketName(environmentType: EnvironmentType): string | undefined {
    const deployTarget = process.env.DEPLOY_ENVIRONMENT?.toLowerCase();

    if (environmentType === EnvironmentType.Dev2) {
        const bucket = process.env.DEV2_DB_DOCS_DEFINITION_BUCKET_NAME;
        if (!bucket && deployTarget === "dev2") {
            // biome-ignore lint/suspicious/noConsole: intentional warning for CDK deploy diagnostics
            console.warn(
                "WARNING: DEV2_DB_DOCS_DEFINITION_BUCKET_NAME is not set for dev2 deploy. S3 docs loading will be disabled."
            );
        }
        return bucket;
    }
    const bucket = process.env.DB_DOCS_DEFINITION_BUCKET_NAME;
    if (!bucket && deployTarget === "prod") {
        // biome-ignore lint/suspicious/noConsole: intentional warning for CDK deploy diagnostics
        console.warn(
            "WARNING: DB_DOCS_DEFINITION_BUCKET_NAME is not set for prod deploy. S3 docs loading will be disabled."
        );
    }
    return bucket;
}
