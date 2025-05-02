import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.TABLE_NAME!;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const movieId = event.pathParameters?.movieId;
  const role    = event.queryStringParameters?.role; 
  if (!movieId || !role) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Both movieId path parameter and role query parameter are required'
      })
    };
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'movieId = :m',
      ExpressionAttributeValues: { ':m': movieId }
    })
  );

  const crewMember = (result.Items ?? []).find(
    item => (item.role as string).toLowerCase() === role.toLowerCase()
  );

  if (!crewMember) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: `No crew member with role '${role}' found for movie ${movieId}`
      })
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(crewMember)
  };
};
