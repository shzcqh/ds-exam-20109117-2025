import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { generateBatch } from "../shared/util";
import { movieCrew } from "../seed/movies";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";

export class ExamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ================================
    // Question 1 – Serverless REST API

   
    const table = new dynamodb.Table(this, "MoviesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "movieId", type: dynamodb.AttributeType.NUMBER },
      sortKey:      { name: "role",    type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName:    "ExamTable",
    });

   
    const question1Fn = new lambdanode.NodejsFunction(this, "Question1Fn", {
      architecture: lambda.Architecture.ARM_64,
      runtime:      lambda.Runtime.NODEJS_22_X,
      entry:        `${__dirname}/../lambdas/get-crew.ts`,
      timeout:      cdk.Duration.seconds(10),
      memorySize:   128,
      environment: {
        TABLE_NAME: table.tableName,
        REGION:     "eu-west-1",
      },
    });

   
    table.grantReadData(question1Fn);

  
    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action:  "batchWriteItem",
        parameters: {
          RequestItems: {
            [table.tableName]: generateBatch(movieCrew),
          },
        },
        physicalResourceId:
          custom.PhysicalResourceId.of("moviesddbInitData"),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [table.tableArn],
      }),
    });

    
    const api = new apig.RestApi(this, "ExamAPI", {
      description: "Exam api",
      deployOptions: { stageName: "dev" },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS","GET","POST","PUT","PATCH","DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const crewResource   = api.root.addResource("crew");
    const moviesResource = crewResource.addResource("movies");
    const byIdResource   = moviesResource.addResource("{movieId}");
    byIdResource.addMethod(
      "GET",
      new apig.LambdaIntegration(question1Fn)
    );

    
    // Question 2 – Event-Driven Architecture

    // 1) SNS Topic
    const topic1 = new sns.Topic(this, "Topic1", {
      displayName: "Exam topic",
    });

    // 2) SQS Queues
    const queueA = new sqs.Queue(this, "QueueA", {
      receiveMessageWaitTime: cdk.Duration.seconds(5),
    });
    const queueB = new sqs.Queue(this, "QueueB", {
      receiveMessageWaitTime: cdk.Duration.seconds(5),
    });

    // 3) Lambdas
    const lambdaXFn = new lambdanode.NodejsFunction(this, "LambdaXFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime:      lambda.Runtime.NODEJS_22_X,
      entry:        `${__dirname}/../lambdas/lambdaX.ts`,
      timeout:      cdk.Duration.seconds(10),
      memorySize:   128,
      environment: { REGION: "eu-west-1" },
    });
    const lambdaYFn = new lambdanode.NodejsFunction(this, "LambdaYFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime:      lambda.Runtime.NODEJS_22_X,
      entry:        `${__dirname}/../lambdas/lambdaY.ts`,
      timeout:      cdk.Duration.seconds(10),
      memorySize:   128,
      environment: { REGION: "eu-west-1" },
    });

    // ── Part A + Part B Implementation ───────────────────────────────
    
    topic1.addSubscription(new subs.SqsSubscription(queueA, {
      filterPolicy: {
        country: sns.SubscriptionFilter.stringFilter({
          allowlist: ["Ireland", "China"],
        }),
      },
    }));

    
    topic1.addSubscription(new subs.LambdaSubscription(lambdaYFn, {
      filterPolicy: {
        country: sns.SubscriptionFilter.stringFilter({
          denylist: ["Ireland", "China"],
        }),
      },
    }));

    
    lambdaXFn.addEventSource(
      new events.SqsEventSource(queueA)
    );
   

    
  }
}
