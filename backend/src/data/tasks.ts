import { DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { ulid } from "ulid";
import { makeDocClient, TABLE_NAME } from "./client";
import { userPk } from "./table";

const doc = makeDocClient();
const TASK_PREFIX = "TASK#";

export type TaskStatus = "not_started" | "in_progress" | "completed";

export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
}

function toTask(i: Record<string, unknown>): Task {
  return {
    id: i.id as string,
    text: i.text as string,
    status: i.status as TaskStatus,
    createdAt: i.createdAt as string,
    completedAt: i.completedAt as string | undefined,
  };
}

export async function createTask(sub: string, text: string): Promise<Task> {
  const id = ulid();
  const createdAt = new Date().toISOString();
  const task: Task = { id, text, status: "not_started", createdAt };
  await doc.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { PK: userPk(sub), SK: `${TASK_PREFIX}${id}`, type: "task", ...task },
  }));
  return task;
}

export async function listTasks(sub: string, status?: TaskStatus): Promise<Task[]> {
  const res = await doc.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :p)",
    ExpressionAttributeValues: { ":pk": userPk(sub), ":p": TASK_PREFIX },
  }));
  const tasks = (res.Items ?? []).map(toTask);
  return status ? tasks.filter((t) => t.status === status) : tasks;
}

export async function deleteTask(sub: string, id: string): Promise<void> {
  await doc.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: userPk(sub), SK: `${TASK_PREFIX}${id}` } }));
}

export async function updateTaskStatus(sub: string, id: string, status: TaskStatus): Promise<Task | null> {
  const common = {
    TableName: TABLE_NAME,
    Key: { PK: userPk(sub), SK: `${TASK_PREFIX}${id}` },
    ConditionExpression: "attribute_exists(SK)",
    ExpressionAttributeNames: { "#s": "status" },
    ReturnValues: "ALL_NEW" as const,
  };
  try {
    const res = await doc.send(new UpdateCommand(
      status === "completed"
        ? {
            ...common,
            UpdateExpression: "SET #s = :status, completedAt = :now",
            ExpressionAttributeValues: { ":status": status, ":now": new Date().toISOString() },
          }
        : {
            ...common,
            UpdateExpression: "SET #s = :status REMOVE completedAt",
            ExpressionAttributeValues: { ":status": status },
          },
    ));
    return toTask(res.Attributes ?? {});
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return null;
    throw err;
  }
}
