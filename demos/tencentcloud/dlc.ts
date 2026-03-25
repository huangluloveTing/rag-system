import { dlc } from "tencentcloud-sdk-nodejs-dlc";
import './load_env.ts'

// 环境变量配置
const config = {
  secretId: process.env.TENCENT_SECRET_ID,
  secretKey: process.env.TENCENT_SECRET_KEY,
  region: process.env.REGION
};

console.log(config)

// 验证必需的配置
if (!config.secretId || !config.secretKey) {
  throw new Error(
    "Missing required environment variables: TENCENT_SECRET_ID, TENCENT_SECRET_KEY",
  );
}

const DlcClient = dlc.v20210125.Client;
const client = new DlcClient({
  credential: {
    secretId: config.secretId,
    secretKey: config.secretKey,
  },
  region: config.region,
});

// 查询参数接口
interface QueryParams {
  startDate: string; // 格式: YYYYMMDD
  endDate: string; // 格式: YYYYMMDD
  limit?: number;
}

// 构建优化后的 SQL 查询
function buildOptimizedQuery(params: QueryParams): string {
  const { startDate, endDate, limit = 1000 } = params;

  return `
  SELECT
  student_id AS id,
  get_json_object (payload, '$.assessment_id') AS assessment_id,
  event_name AS name,
  platform
  FROM
    \`DataLakeCatalog\`.\`app_event_log\`.\`event_log\`
  WHERE
    event_name = 'placement_test_finish'
    AND student_id = '8811147'
  `.trim();
}

// 执行查询
async function executeQuery(params: QueryParams) {
  try {
    const sql = buildOptimizedQuery(params);

    // 关键：SQL 必须 base64 编码
    const base64SQL = Buffer.from(sql).toString("base64");
    console.log("Original SQL:", sql);

    const response = await client.CreateTasks({
      DatasourceConnectionName: "DataLakeCatalog",
      DatabaseName: "",
      DataEngineName: "spark",
      Tasks: {
        TaskType: "SparkSQLTask",
        SQL: base64SQL,
        FailureTolerance: "Terminate",
        Config: [],
        Params: [],
      },
      ResourceGroupName: "default-rg-az6p4j02ov",
      SourceInfo: [
        {
          Key: "source",
          Value: "dataExploration",
        },
      ],
    });

    console.log("Task created successfully:", response.TaskIdSet);

    return {
      success: true,
      taskIds: response.TaskIdSet || [],
      batchId: response.BatchId,
      data: response,
      error: null,
    };
  } catch (error) {
    console.error("Query execution failed:", error);
    return {
      success: false,
      taskIds: [],
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// 查询任务结果
async function getTaskResult(taskId: string) {
  try {
    const response = await client.DescribeTaskResult({
      TaskId: taskId
    });

    return {
      success: true,
      data: response,
      error: null,
    };
  } catch (error) {
    console.error("Get task result failed:", error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

const executeTaskQuery = async (taskId: string) => {
while (true && taskId) {
    await new Promise((resolve) => setTimeout(resolve, 3000)); // 等待 3 秒

    const resultResponse = await getTaskResult(taskId);

    if (resultResponse.success && resultResponse.data?.TaskInfo) {
      // 0：初始化 1：任务运行中 2：任务执行成功  3：数据写入中 4：排队中 -1：任务执行失败 -3：用户手动终止
      const state = resultResponse.data.TaskInfo.State;
      console.log(
        "Task state:",
        state,
        " -- 0：初始化 1：任务运行中 2：任务执行成功  3：数据写入中 4：排队中 -1：任务执行失败 -3：用户手动终止",
      );
      if (state === 2) {
        console.log(JSON.stringify(resultResponse.data.TaskInfo.ResultSchema, null, 2))
        return JSON.parse(resultResponse.data.TaskInfo.ResultSet || '[]')
      }
      if (state === 1 || state === 0 || state === 4) {
        continue
      } else {
        console.log("***: ", "查询失败 ： ", resultResponse.error);
        return []
        break
      }
    }
  }
}

// 使用示例
async function main() {
  // 1. 创建任务
  const createResult = await executeQuery({
    startDate: "20260310",
    endDate: "20260317",
    limit: 1000,
  });

  if (!createResult.success || createResult.taskIds.length === 0) {
    console.error("Failed to create task:", createResult.error);
    return;
  }

  const taskId = createResult.taskIds[0];
  const result = await executeTaskQuery(taskId)
  console.log(result)
}

// 运行
main().catch(console.error);
