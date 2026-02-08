import type { NeonQueryFunction } from "@neondatabase/serverless";

export async function canUserSeeTask(
  sql: NeonQueryFunction<false, false>,
  userId: string,
  userRole: string,
  taskId: string,
): Promise<boolean> {
  if (userRole === "מנהל") {
    return true;
  }

  const task = await sql`
    SELECT "isGeneral", section, topic, "leaderId"
    FROM "task"
    WHERE id = ${taskId}
  `;

  if (task.length === 0) {
    return false;
  }

  const taskData = task[0];

  if (taskData.isGeneral) {
    const isAssigned = await sql`
      SELECT 1
      FROM "taskUser"
      WHERE "taskId" = ${taskId} AND "userId" = ${userId}
    `;
    return taskData.leaderId === userId || isAssigned.length > 0;
  }

  const userTopics = await sql`
    SELECT section, topic
    FROM "userTopic"
    WHERE "userId" = ${userId}
      AND section = ${taskData.section}
      AND topic = ${taskData.topic}
  `;

  return userTopics.length > 0;
}

export async function canUserSeeParentTask(
  sql: NeonQueryFunction<false, false>,
  userId: string,
  userRole: string,
  parentTaskId: string,
): Promise<boolean> {
  if (userRole === "מנהל") {
    return true;
  }

  const parentTask = await sql`
    SELECT section, topic
    FROM "parentTask"
    WHERE id = ${parentTaskId}
  `;

  if (parentTask.length === 0) {
    return false;
  }

  const parentTaskData = parentTask[0];

  const userTopics = await sql`
    SELECT section, topic
    FROM "userTopic"
    WHERE "userId" = ${userId}
      AND section = ${parentTaskData.section}
      AND topic = ${parentTaskData.topic}
  `;

  return userTopics.length > 0;
}
