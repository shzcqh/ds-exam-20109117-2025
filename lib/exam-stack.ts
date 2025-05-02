import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as iam from "aws-cdk-lib/aws-iam";
import { generateBatch } from "../shared/util";
import { movieCrew } from "../seed/movies";

export class ExamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ================================
    // Question 1 – Serverless REST API
    // ================================
    const table = new dynamodb.Table(this, "MoviesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey:      { name: "role",    type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName:    "ExamTable",
    });

    const question1Fn = new lambdanode.NodejsFunction(this, "Question1Fn", {
      runtime:    lambda.Runtime.NODEJS_22_X,
      entry:      `${__dirname}/../lambdas/get-crew.ts`,
      timeout:    cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: table.tableName,
        REGION:     "eu-west-1",
      },
    });
    table.grantReadData(question1Fn);

    // seed data
    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action:  "batchWriteItem",
        parameters: {
          RequestItems: {
            [table.tableName]: generateBatch(movieCrew),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [table.tableArn],
      }),
    });

    // API Gateway
    const api = new apig.RestApi(this, "ExamAPI", {
      description: "Exam api",
      deployOptions: { stageName: "dev" },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type","X-Amz-Date"],
        allowMethods: ["OPTIONS","GET","POST","PUT","PATCH","DELETE"],
        allowOrigins: ["*"],
        allowCredentials: true
      },
    });

    const crew = api.root.addResource("crew");
    const movies = crew.addResource("movies");
    const byId = movies.addResource("{movieId}");
    byId.addMethod("GET", new apig.LambdaIntegration(question1Fn));

    // ================================
    // Question 2 – Event‐Driven Architecture
    // ================================

    // SNS Topic
    const topic1 = new sns.Topic(this, "Topic1", {
      displayName: "Exam topic"
    });

    // SQS queues
    const queueA = new sqs.Queue(this, "QueueA", {
      receiveMessageWaitTime: cdk.Duration.seconds(5)
    });
    const queueB = new sqs.Queue(this, "QueueB", {
      receiveMessageWaitTime: cdk.Duration.seconds(5)
    });

    // Lambda X (reads from QueueA)
    const lambdaXFn = new lambdanode.NodejsFunction(this, "LambdaXFn", {
      runtime:    lambda.Runtime.NODEJS_22_X,
      entry:      `${__dirname}/../lambdas/lambdaX.ts`,
      timeout:    cdk.Duration.seconds(10),
      memorySize: 128,
      environment: { REGION: "eu-west-1" }
    });
    // hook QueueA → LambdaX
    lambdaXFn.addEventSource(new events.SqsEventSource(queueA));
    queueA.grantConsumeMessages(lambdaXFn);

    // Lambda Y (will forward missing‐email to QueueB)
    const lambdaYFn = new lambdanode.NodejsFunction(this, "LambdaYFn", {
      runtime:    lambda.Runtime.NODEJS_22_X,
      entry:      `${__dirname}/../lambdas/lambdaY.ts`,
      timeout:    cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        REGION:      "eu-west-1",
        QUEUE_B_URL: queueB.queueUrl
      }
    });
    queueB.grantSendMessages(lambdaYFn);

    // ── Part A: Ireland|China → QueueA ───────────────────────────────────
    // We use a low‐level CfnSubscription to attach a filterPolicy on country
    new sns.CfnSubscription(this, "SubQueueA", {
      topicArn:    topic1.topicArn,
      protocol:    "sqs",
      endpoint:    queueA.queueArn,
      filterPolicy: {
        country: ["Ireland", "China"]
      }
    });
    // allow SNS → QueueA
    queueA.addToResourcePolicy(new iam.PolicyStatement({
      actions: ["sqs:SendMessage"],
      principals: [new iam.ServicePrincipal("sns.amazonaws.com")],
      resources: [queueA.queueArn],
      conditions: {
        ArnEquals: { "aws:SourceArn": topic1.topicArn }
      }
    }));

    // ── Part B: other countries → LambdaY ─────────────────────────────────
    new sns.CfnSubscription(this, "SubLambdaY", {
      topicArn:    topic1.topicArn,
      protocol:    "lambda",
      endpoint:    lambdaYFn.functionArn,
      filterPolicy: {
        country: { "anything-but": ["Ireland", "China"] }
      }
    });
    // grant SNS invoke LambdaY
    lambdaYFn.addPermission("AllowSNSInvoke", {
      principal: new iam.ServicePrincipal("sns.amazonaws.com"),
      sourceArn: topic1.topicArn
    });

    // ── Part C: LambdaY will itself forward missing‐email to QueueB ────────
    // (logic inside lambdaY.ts)

    // done
  }
}
