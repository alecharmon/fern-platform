import { type EnvironmentInfo, EnvironmentType } from "@fern-fern/fern-cloud-sdk/api/resources/environments";
import { Stack, type StackProps } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as actions from "aws-cdk-lib/aws-cloudwatch-actions";
import { Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage, FargateService, FargateTaskDefinition, LogDriver } from "aws-cdk-lib/aws-ecs";
import { LogGroup } from "aws-cdk-lib/aws-logs";
import { PrivateDnsNamespace } from "aws-cdk-lib/aws-servicediscovery";
import * as sns from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import type { Construct } from "constructs";

const CONTAINER_NAME = "fai-discord";
const SERVICE_NAME = "fai-discord";

export interface FaiDiscordEnvVariables {
    // Core API Keys needed by Discord bot
    ANTHROPIC_API_KEY: string;
    OPENAI_API_KEY: string;
    TURBOPUFFER_API_KEY: string;
    // Database
    POSTGRES_DATABASE_URL: string;
    // Discord specific
    DISCORD_BOT_TOKEN: string;
    DISCORD_OAUTH_URL: string;
    [key: string]: string;
}

export class FaiDiscordDeployStack extends Stack {
    constructor(
        scope: Construct,
        id: string,
        version: string,
        environmentType: EnvironmentType,
        environmentInfo: EnvironmentInfo,
        envVariables: FaiDiscordEnvVariables,
        props?: StackProps
    ) {
        super(scope, id, props);

        const vpc = Vpc.fromLookup(this, "vpc", {
            vpcId: environmentInfo.vpcId
        });

        const discordSg = new SecurityGroup(this, "fai-discord-sg", {
            securityGroupName: `fai-discord-${environmentType.toLowerCase()}`,
            vpc,
            allowAllOutbound: true
        });
        discordSg.addIngressRule(Peer.ipv4(environmentInfo.vpcIpv4Cidr), Port.allTcp());

        const cluster = Cluster.fromClusterAttributes(this, "cluster", {
            clusterName: environmentInfo.ecsInfo.clusterName,
            vpc,
            securityGroups: []
        });

        const cloudmapNamespaceName = environmentInfo.cloudMapNamespaceInfo.namespaceName;
        const cloudMapNamespace = PrivateDnsNamespace.fromPrivateDnsNamespaceAttributes(this, "private-cloudmap", {
            namespaceArn: environmentInfo.cloudMapNamespaceInfo.namespaceArn,
            namespaceId: environmentInfo.cloudMapNamespaceInfo.namespaceId,
            namespaceName: cloudmapNamespaceName
        });

        const logGroup = LogGroup.fromLogGroupName(this, "log-group", environmentInfo.logGroupInfo.logGroupName);

        const snsTopic = new sns.Topic(this, "fai-discord-sns-topic", {
            topicName: id
        });
        snsTopic.addSubscription(new EmailSubscription("alerts@buildwithfern.com"));

        const environmentResources =
            environmentType === EnvironmentType.Prod
                ? {
                      cpu: 1024,
                      memoryLimitMiB: 2048,
                      desiredCount: 1
                  }
                : {
                      cpu: 512,
                      memoryLimitMiB: 1024,
                      desiredCount: 1
                  };

        const taskDefinition = new FargateTaskDefinition(this, "task-definition", {
            cpu: environmentResources.cpu,
            memoryLimitMiB: environmentResources.memoryLimitMiB
        });

        taskDefinition.addContainer(CONTAINER_NAME, {
            image: ContainerImage.fromTarball(`../fai:${version}.tar`),
            logging: LogDriver.awsLogs({
                logGroup,
                streamPrefix: SERVICE_NAME
            }),
            environment: {
                ...envVariables
            }
        });

        const fargateService = new FargateService(this, SERVICE_NAME, {
            serviceName: SERVICE_NAME,
            cluster,
            taskDefinition,
            desiredCount: environmentResources.desiredCount,
            securityGroups: [discordSg],
            assignPublicIp: true,
            enableECSManagedTags: true,
            enableExecuteCommand: environmentType !== EnvironmentType.Prod,
            cloudMapOptions:
                cloudMapNamespace != null
                    ? {
                          cloudMapNamespace,
                          name: SERVICE_NAME
                      }
                    : undefined
        });

        const cpuUtilizationAlarm = new cloudwatch.Alarm(
            this,
            `fai-discord-${environmentType.toLowerCase()}-cpu-utilization-alarm`,
            {
                alarmName: `${id} CPU Utilization Threshold`,
                metric: fargateService.metricCpuUtilization(),
                threshold: 80,
                evaluationPeriods: 5
            }
        );
        cpuUtilizationAlarm.addAlarmAction(new actions.SnsAction(snsTopic));

        const memoryUtilizationAlarm = new cloudwatch.Alarm(
            this,
            `fai-discord-${environmentType.toLowerCase()}-memory-utilization-alarm`,
            {
                alarmName: `${id} Memory Utilization Threshold`,
                metric: fargateService.metricMemoryUtilization(),
                threshold: 80,
                evaluationPeriods: 5
            }
        );
        memoryUtilizationAlarm.addAlarmAction(new actions.SnsAction(snsTopic));
    }
}
