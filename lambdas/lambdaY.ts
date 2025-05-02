import { SNSEvent } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// 1) Initialize the SQS client
const sqsClient = new SQSClient({});

// 2) Read the URL of Queue B from an environment variable
const queueUrl = process.env.QUEUE_B_URL!;

export const handler = async (event: SNSEvent): Promise<void> => {
  for (const record of event.Records) {
    // Sens Mesag in Recod. Sens. Mesa
    const payload = JSON.parse(record.Sns.Message);

    // If an email is missing, write the message to QueueB
    if (!payload.email) {
      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl:    queueUrl,
          MessageBody: JSON.stringify(payload),
        })
      );
    }
  }
};
