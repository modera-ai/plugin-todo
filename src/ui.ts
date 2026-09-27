import type {
  PluginUiContribution,
  PluginUiNode,
  ToolContribution,
} from "@modera/plugin-sdk";

type Todo = { id: string; content: string; status: string };
const panelId = "modera.todo.panel";
const permissions = ["storage.read", "storage.write"] as const;
const words = (locale: string) =>
  locale.startsWith("zh")
    ? {
        title: "待办列表",
        empty: "暂无待办项",
        add: "添加",
        placeholder: "添加待办…",
        remove: "删除",
        complete: "已完成",
        pending: "待完成",
        progress: "进行中",
        open: "在标题栏查看完整列表",
        actions: {
          get: "查看待办",
          add: "添加待办",
          update: "更新待办",
          delete: "删除待办",
        },
      }
    : {
        title: "Tasks",
        empty: "No tasks yet",
        add: "Add",
        placeholder: "Add a task…",
        remove: "Delete",
        complete: "completed",
        pending: "pending",
        progress: "in progress",
        open: "Open full list in header",
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
      id: panelId,
      slot: "conversation.header",
      icon: "checklist",
      requiredPermissions: permissions,
      actions: ["add", "cycle", "delete"],
      async act(action, context) {
        if (action.id === "add") {
          await execute({ action: "add", content: action.value }, context);
          return;
        }
        if (!action.value) throw new Error("Task ID required");
        if (action.id === "delete") {
          await execute({ action: "delete", todoId: action.value }, context);
          return;
        }
        const todos = parse(await execute({ action: "get" }, context));
        const item = todos.find((todo) => todo.id === action.value);
        if (!item) throw new Error("Task not found");
        const status =
          item.status === "pending"
            ? "inProgress"
            : item.status === "inProgress"
              ? "completed"
              : "pending";
        await execute({ action: "update", todoId: item.id, status }, context);
      },
      async render(request, context) {
        const w = words(request.locale);
        const todos = parse(await execute({ action: "get" }, context));
        const completed = todos.filter(
          (item) => item.status === "completed",
        ).length;
        const children: PluginUiNode[] = todos.map((item) => ({
          type: "row",
          children: [
            {
              type: "button",
              label:
                item.status === "completed"
                  ? w.complete
                  : item.status === "inProgress"
                    ? w.progress
                    : w.pending,
              icon:
                item.status === "completed"
                  ? "check"
                  : item.status === "inProgress"
                    ? "progress"
                    : "circle",
              action: "cycle",
              value: item.id,
              quiet: true,
            },
            {
              type: "text",
              text: item.content,
              ...(item.status === "completed"
                ? { tone: "muted" as const }
                : {}),
            },
            {
              type: "button",
              label: w.remove,
              icon: "trash",
              action: "delete",
              value: item.id,
              quiet: true,
            },
          ],
        }));
        if (!todos.length)
          children.push({ type: "text", text: w.empty, tone: "muted" });
        children.push({
          type: "form",
          label: w.add,
          placeholder: w.placeholder,
          action: "add",
          maxLength: 2000,
        });
        return {
          title: w.title,
          badge: `${completed}/${todos.length} ${w.complete}`,
          children,
        };
      },
    },
    {
      id: "modera.todo.result",
      slot: "tool.result",
      hostRenderer: "todo-result",
      toolNames: ["todo_manage"],
      requiredPermissions: ["storage.read"],
      async render(request) {
        const w = words(request.locale);
        const input = request.tool?.input as
          { action?: string; content?: string | string[] } | undefined;
        const action = input?.action as keyof typeof w.actions;
        let todos: Todo[] = [];
        if (request.tool?.result)
          todos = parse(JSON.parse(request.tool.result));
        return {
          title: w.actions[action] ?? w.title,
          data: { todos, content: input?.content, panelId, openLabel: w.open },
          children: [],
        };
      },
    },
  ];
}
