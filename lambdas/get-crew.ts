import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.TABLE_NAME!;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  
  
  const movieIdStr = event.pathParameters?.movieId;
  if (!movieIdStr) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'movieId path parameter is required' })
    };
  }
  const movieId = Number(movieIdStr);
  if (isNaN(movieId)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'movieId must be a number' })
    };
  }

  
  const role = event.queryStringParameters?.role;

  
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'movieId = :m',
      ExpressionAttributeValues: { ':m': movieId }
    })
  );
  let crewList = result.Items ?? [];

  
  if (role) {
    crewList = crewList.filter(
      item => (item.role as string).toLowerCase() === role.toLowerCase()
    );
  }

  
  return {
    statusCode: 200,
    body: JSON.stringify(crewList)
  };
};
