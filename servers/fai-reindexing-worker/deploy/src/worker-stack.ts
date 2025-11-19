import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api/resources/environments";
import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import { type IVpc, Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import {
    Cluster,
    ContainerImage,
    FargateService,
    FargateTaskDefinition,
    type ICluster,
    LogDriver
} from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import { type ILogGroup, LogGroup } from "aws-cdk-lib/aws-logs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

export class FaiReindexingWorkerStack extends Stack {
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

        const workerSg = new SecurityGroup(this, "worker-sg", {
            securityGroupName: `fai-reindexing-worker-${environmentType.toLowerCase()}`,
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

        // Create Dead Letter Queue for failed reindexing jobs
        const reindexingDlq = new sqs.Queue(this, "reindexing-dlq", {
            queueName: `fai-reindexing-dlq-${environmentType.toLowerCase()}`,
            retentionPeriod: Duration.days(14)
        });

        // Create SQS queue for reindexing jobs
        const reindexingQueue = new sqs.Queue(this, "reindexing-queue", {
            queueName: `fai-reindexing-${environmentType.toLowerCase()}`,
            visibilityTimeout: Duration.seconds(1200),
            retentionPeriod: Duration.days(14),
            deadLetterQueue: {
                queue: reindexingDlq,
                maxReceiveCount: 2
            }
        });

        this.createReindexingWorkerService({
            cluster,
            vpc,
            workerSg,
            logGroup,
            version,
            environmentType,
            reindexingQueue
        });
    }

    private createReindexingWorkerService(props: {
        cluster: ICluster;
        vpc: IVpc;
        workerSg: SecurityGroup;
        logGroup: ILogGroup;
        version: string;
        environmentType: EnvironmentType;
        reindexingQueue: sqs.Queue;
    }): void {
        const { cluster, workerSg, logGroup, version, environmentType, reindexingQueue } = props;

        const workerTaskDefinition = new FargateTaskDefinition(this, "worker-task-def", {
            cpu: 2048,
            memoryLimitMiB: 8192
        });

        workerTaskDefinition.addContainer("fai-reindexing-worker", {
            containerName: "fai-reindexing-worker",
            image: ContainerImage.fromTarball(`../fai-reindexing-worker:${version}.tar`),
            logging: LogDriver.awsLogs({
                logGroup,
                streamPrefix: "fai-reindexing-worker"
            }),
            environment: {
                NODE_OPTIONS: "--max-old-space-size=7168",
                SQS_QUEUE_URL: reindexingQueue.queueUrl,
                OPENAI_API_KEY: getEnvVarOrThrow("OPENAI_API_KEY"),
                TURBOPUFFER_API_KEY: getEnvVarOrThrow("TURBOPUFFER_API_KEY"),
                FERN_TOKEN: getEnvVarOrThrow("FERN_TOKEN"),
                KV_REST_API_TOKEN: getEnvVarOrThrow("KV_REST_API_TOKEN"),
                KV_REST_API_URL: getEnvVarOrThrow("KV_REST_API_URL"),
                FAI_ORIGIN: getFaiOrigin(environmentType),
                FDR_ORIGIN: getFdrOrigin(environmentType),
                FDR_LAMBDA_ORIGIN: getFdrLambdaOrigin(environmentType),
                FERN_DOCS_INDEX_NAME: "fern-docs"
            }
        });

        reindexingQueue.grantConsumeMessages(workerTaskDefinition.taskRole);

        reindexingQueue.grantSendMessages(
            iam.User.fromUserArn(this, "vercel-user", "arn:aws:iam::985111089818:user/vercel")
        );

        // Grant Lambda invoke permissions (if needed for indexing)
        workerTaskDefinition.taskRole.addToPrincipalPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["lambda:InvokeFunction"],
                resources: ["arn:aws:lambda:us-east-1:985111089818:function:fai-code-indexing-*"]
            })
        );

        const service = new FargateService(this, "worker-service", {
            serviceName: "fai-reindexing-worker",
            cluster,
            taskDefinition: workerTaskDefinition,
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
}

function getEnvVarOrThrow(envVarName: string): string {
    const val = process.env[envVarName];
    if (val != null) {
        return val;
    }
    throw Error("Expected environment variable to be defined: " + envVarName);
}

function getFaiOrigin(environmentType: EnvironmentType): string {
    if (environmentType === EnvironmentType.Prod) {
        return "https://fai.buildwithfern.com";
    }
    return `https://fai-${environmentType.toLowerCase()}.buildwithfern.com`;
}

function getFdrOrigin(environmentType: EnvironmentType): string {
    if (environmentType === EnvironmentType.Prod) {
        return "https://registry.buildwithfern.com";
    }
    return `https://registry-${environmentType.toLowerCase()}.buildwithfern.com`;
}

function getFdrLambdaOrigin(environmentType: EnvironmentType): string {
    if (environmentType === EnvironmentType.Prod) {
        return "https://registry-v2.buildwithfern.com";
    }
    return `https://registry-v2-${environmentType.toLowerCase()}.buildwithfern.com`;
}
