export function chunkText(text, maxChars = 800) {
  const chunks = [];
  const paragraphs = text.split(/\n{1,}/).filter(Boolean);

  let buffer = "";
  for (const p of paragraphs) {
    if ((buffer + "\n\n" + p).length <= maxChars) {
      buffer = buffer ? buffer + "\n\n" + p : p;
    } else {
      if (buffer) {
        chunks.push(buffer);
      }
      // nếu paragraph dài hơn maxChars thì cắt
      if (p.length > maxChars) {
        for (let i = 0; i < p.length; i += maxChars) {
          chunks.push(p.slice(i, i + maxChars));
        }
        buffer = "";
      } else {
        buffer = p;
      }
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks;
}
