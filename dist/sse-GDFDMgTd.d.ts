type SSEEvent = {
    text: string;
} | {
    tool_status: string;
    status: "executing" | "done" | "error";
    summary?: string;
} | {
    link: {
        href: string;
        label: string;
    };
} | {
    refresh: true;
} | {
    error: string;
};
declare const SSE_DONE = "[DONE]";
declare function encodeSSE(event: SSEEvent): string;
declare function encodeDone(): string;
declare function encodeComment(text: string): string;

export { type SSEEvent as S, SSE_DONE as a, encodeDone as b, encodeSSE as c, encodeComment as e };
