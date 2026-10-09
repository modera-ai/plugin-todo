import type {
  PluginUiContribution,
  ToolContribution,
} from "@modera/plugin-sdk";

type Todo = { id: string; content: string; status: string };
const permissions = ["storage.read", "storage.write"] as const;
const words = (locale: string) =>
  locale.startsWith("zh")
    ? {
        title: "待办列表",
        complete: "已完成",
        actions: {
          get: "查看待办",
          add: "添加待办",
          update: "更新待办",
          delete: "删除待办",
        },
      }
    : {
        title: "Tasks",
        complete: "completed",
        actions: {
          get: "View tasks",
          add: "Add task",
          update: "Update task",
          delete: "Delete task",
        },
      };
function parse(value: unknown): Todo[] {
  if (
    !value ||
    typeof value !== "object" ||
    !("todos" in value) ||
    !Array.isArray(value.todos)
  )
    return [];
  return value.todos.filter((item): item is Todo =>
    Boolean(
      item &&
      typeof item.id === "string" &&
      typeof item.content === "string" &&
      typeof item.status === "string",
    ),
  );
}
export function todoUi(
  execute: ToolContribution["execute"],
): PluginUiContribution[] {
  return [
    {
      id: "modera.todo.panel",
      slot: "conversation.before-composer",
      hostRenderer: "todo-panel",
      viewLimits: { maxChars: 5000000, maxValues: 30000 },
      icon: "checklist",
      requiredPermissions: permissions,
      async render(request, context) {
        const w = words(request.locale);
        const todos = parse(await execute({ action: "get" }, context));
        const completed = todos.filter(
          (item) => item.status === "completed",
        ).length;
        return {
          title: w.title,
          data: { todos },
          badge: `${completed}/${todos.length} ${w.complete}`,
          children: [],
        };
      },
    },
    {
      id: "modera.todo.result",
      slot: "tool.result",
      hostRenderer: "todo-result",
      viewLimits: { maxChars: 5000000, maxValues: 30000 },
      toolNames: ["todo_manage"],
      requiredPermissions: ["storage.read"],
      async render(request) {
        const w = words(request.locale);
        const input = request.tool?.input as
          { action?: string; content?: string | string[] } | undefined;
        const action = input?.action as keyof typeof w.actions;
        const todos = request.tool?.result
          ? parse(JSON.parse(request.tool.result))
          : [];
        return {
          title: w.actions[action] ?? w.title,
          data: { todos, content: input?.content },
          children: [],
        };
      },
    },
  ];
}
