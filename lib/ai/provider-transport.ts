export function nvidiaStructuredBody(body: string): string {
  const value = JSON.parse(body);
  if (
    value.response_format?.type === "json_object" ||
    value.response_format?.type === "json_schema"
  )
    return JSON.stringify({
      ...value,
      chat_template_kwargs: { ...value.chat_template_kwargs, enable_thinking: false },
    });
  return body;
}
