import manifest from "../plugin.json";
import { declaredTool } from "@modera/plugin-sdk";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type {
  PluginModule,
  ToolDefinition,
  ToolContribution,
} from "@modera/plugin-sdk";
import { todoUi } from "./ui";

const definition = declaredTool(manifest, "todo_manage");
type Todo = { id: string; content: string; status: string };
export const activate: PluginModule["activate"] = async (host) => {
  const queues = new Map<string, Promise<unknown>>();
  const execute: ToolContribution["execute"] = async (input, context) => {
    const { action, todoId, content, status } = input as {
      action: string;
      todoId?: string | string[];
      content?: string | string[];
      status?: string;
    };
    if (!["get", "add", "update", "delete"].includes(action))
      throw new Error("Invalid TODO action");
    const contents =
      content === undefined ? [] : Array.isArray(content) ? content : [content];
    if (
      contents.length > 100 ||
      (content !== undefined && !contents.length) ||
      contents.some(
        (value) =>
          typeof value !== "string" || !value.trim() || value.length > 2000,
      ) ||
      (action !== "add" && Array.isArray(content))
    )
      throw new Error("Invalid TODO content");
    if (
      status !== undefined &&
      !["pending", "inProgress", "completed"].includes(status)
    )
      throw new Error("Invalid TODO status");
    const key = createHash("sha256").update(context.sessionId).digest("hex");
    const operation = (queues.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(async () => {
        context.signal.throwIfAborted();
        const path = join(host.storagePath, `${key}.json`);
        let todos: Todo[];
        try {
          todos = JSON.parse(await readFile(path, "utf8")) as Todo[];
        } catch (cause) {
          if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
          todos = [];
        }
        if (action === "get") return { todos };
        if (action === "add") {
          if (!contents.length || todos.length + contents.length > 500)
            throw new Error("Content required; maximum 500 items");
          todos.push(
            ...contents.map((value) => ({
              id: randomUUID(),
              content: value.trim(),
              status: "pending",
            })),
          );
        } else {
          const ids = Array.isArray(todoId) ? todoId : [todoId];
          if (
            !ids.length ||
            ids.length > 100 ||
            new Set(ids).size !== ids.length ||
            ids.some(
              (id) =>
                typeof id !== "string" || !todos.some((todo) => todo.id === id),
            )
          )
            throw new Error("Unknown TODO ID or invalid batch");
          if (action === "delete")
            todos = todos.filter((todo) => !ids.includes(todo.id));
          else {
            for (const item of todos.filter((todo) => ids.includes(todo.id))) {
              if (typeof content === "string") item.content = content;
              if (status) item.status = status;
            }
          }
        }
        context.signal.throwIfAborted();
        const temporary = `${path}.tmp`;
        await writeFile(temporary, JSON.stringify(todos));
        await rename(temporary, path);
        return { todos };
      });
    queues.set(key, operation);
    void operation
      .finally(() => {
        if (queues.get(key) === operation) queues.delete(key);
      })
      .catch(() => {});
    return operation;
  };
  return { tools: [{ definition, execute }], ui: todoUi(execute) };
};
