/**
 * Renderiza texto simples do CMS com segurança (sem HTML):
 * blocos separados por linha em branco; "## " = subtítulo; linhas com "- " = lista.
 */
export function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="prose-montez">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const out: React.ReactNode[] = [];
        let list: string[] = [];
        const flush = (k: string) => {
          if (list.length) {
            out.push(
              <ul key={k}>
                {list.map((li, j) => (
                  <li key={j}>{li}</li>
                ))}
              </ul>
            );
            list = [];
          }
        };
        lines.forEach((line, j) => {
          if (line.startsWith("## ")) {
            flush(`l${j}`);
            out.push(<h2 key={`h${j}`}>{line.slice(3)}</h2>);
          } else if (line.startsWith("- ")) {
            list.push(line.slice(2));
          } else {
            flush(`l${j}`);
            out.push(<p key={`p${j}`}>{line}</p>);
          }
        });
        flush("end");
        return <div key={i}>{out}</div>;
      })}
    </div>
  );
}
