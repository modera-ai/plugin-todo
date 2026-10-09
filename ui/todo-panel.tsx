import React from "react";
import { TodoList } from "@modera/ui";
import type { PluginToolRendererProps } from "@modera/plugin-sdk";

export default function TodoPanel({
  data,
  title,
  error,
}: PluginToolRendererProps) {
  const todos =
    (
      data as
        | { todos?: { id: string; content: string; status: string }[] }
        | undefined
    )?.todos ?? [];
  if (!todos.length && !error) return null;
  return (
    <>
      {todos.length > 0 && (
        <TodoList
          maxHeight={152}
          title={title}
          items={todos.map((item) => ({
            id: item.id,
            title: item.content,
            status:
              item.status === "inProgress"
                ? "in-progress"
                : (item.status as "pending" | "completed" | "cancelled"),
          }))}
        />
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
