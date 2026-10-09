import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { activate as todo } from "../src";

it("TODO persists scoped lists, serializes writes and rejects unknown IDs", async () => {
  const root = await mkdtemp(join(tmpdir(), "modera-todo-test-"));
  try {
    const host = {
      pluginId: "todo",
      storagePath: root,
      grantedPermissions: new Set<"storage.read" | "storage.write">([
        "storage.read",
        "storage.write",
      ]),
      signal: new AbortController().signal,
      invalidateUi: vi.fn(),
    };
    const contributions = await todo(host);
    expect(contributions!.ui!.find(item => item.id === "modera.todo.panel")).toMatchObject({ slot: "conversation.before-composer", hostRenderer: "todo-panel" });
    const execute = contributions!.tools![0]!.execute;
    const context = {
      sessionId: "s",
      runId: "r",
      signal: new AbortController().signal,
    };
    await Promise.all([
      execute({ action: "add", content: "first" }, context),
      execute({ action: "add", content: "second" }, context),
    ]);
    const result = (await execute({ action: "get" }, context)) as {
      todos: { id: string; status: string }[];
    };
    expect(result.todos).toHaveLength(2);
    expect(host.invalidateUi).toHaveBeenCalledWith("s");
    await expect(
      execute({ action: "add", content: ["valid", " "] }, context),
    ).rejects.toThrow("content");
    const batch = (await execute(
      { action: "add", content: ["third", "fourth", "fifth"] },
      context,
    )) as { todos: { id: string }[] };
    expect(batch.todos).toHaveLength(5);
    const ids = batch.todos.slice(2).map((item) => item.id);
    await expect(
      execute(
        { action: "update", todoId: [ids[0], "unknown"], status: "completed" },
        context,
      ),
    ).rejects.toThrow("Unknown");
    expect(await execute({ action: "get" }, context)).toMatchObject({
      todos: Array.from({ length: 5 }, () => ({ status: "pending" })),
    });
    expect(
      await execute(
        { action: "update", todoId: ids, status: "completed" },
        context,
      ),
    ).toMatchObject({
      todos: [
        { status: "pending" },
        { status: "pending" },
        { status: "completed" },
        { status: "completed" },
        { status: "completed" },
      ],
    });
    await execute({ action: "delete", todoId: ids }, context);
    expect(
      await execute({ action: "get" }, { ...context, sessionId: "other" }),
    ).toEqual({ todos: [] });
    await expect(
      execute({ action: "delete", todoId: "invented" }, context),
    ).rejects.toThrow("Unknown");
    await execute(
      { action: "update", todoId: result.todos[0]!.id, status: "completed" },
      context,
    );
    const reopened = await todo(host);
    expect(
      await reopened!.tools![0]!.execute({ action: "get" }, context),
    ).toMatchObject({
      todos: [{ status: "completed" }, { status: "pending" }],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
