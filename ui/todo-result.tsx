import React from "react";
import { ToolExecution, TodoList } from "@modera/ui";
import type { PluginToolRendererProps } from "@modera/plugin-sdk";

export default function TodoResult({
  call,
  result,
  state,
  title,
  locale,
  open,
  onOpenChange,
}: PluginToolRendererProps) {
  let output: unknown = result;
  if (result) {
    try {
      output = JSON.parse(result);
    } catch {
      /* Keep text when a tool returns non-JSON. */
    }
  }
  const tasks =
    output &&
    typeof output === "object" &&
    "todos" in output &&
    Array.isArray(output.todos)
      ? (output.todos as { content?: string; status?: string }[])
      : [];
  const completed = tasks.filter((item) => item.status === "completed").length;
  const action =
    call.input && typeof call.input === "object" && "action" in call.input
      ? String(call.input.action)
      : "";
  return (
    <ToolExecution
      kind="tasks"
      name={call.name}
      title={title}
      target={action}
      metric={tasks.length ? `${completed}/${tasks.length}` : undefined}
      tone="blue"
      state={state}
      input={call.input}
      output={output}
      open={open}
      onOpenChange={onOpenChange}
      locale={locale}
    >
      <TodoList
        maxHeight={152}
        items={tasks.map((item, index) => ({
          id: String(index),
          title: item.content,
          status:
            item.status === "inProgress"
              ? "in-progress"
              : (item.status as "pending" | "completed" | "cancelled"),
        }))}
      />
    </ToolExecution>
  );
}
