import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Link as LinkIcon, List, ListOrdered,
  Heading2, Heading3, Quote, Image as ImageIcon, Code2,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { criarUploadUrl } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

export function RichTextEditor({ value, onChange }: Props) {
  const [showHtml, setShowHtml] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadFn = useServerFn(criarUploadUrl);
  const skipUpdateRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: "Escreva a matéria…" }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose-h4l min-h-[420px] max-w-none rounded-b-md border border-t-0 border-border bg-card px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      if (skipUpdateRef.current) return;
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  // Sincroniza quando o valor externo muda (ex.: ao carregar o post)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) {
      skipUpdateRef.current = true;
      editor.commands.setContent(value, { emitUpdate: false });
      skipUpdateRef.current = false;
    }
  }, [editor, value]);

  if (!editor) {
    return <div className="min-h-[420px] rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">Carregando editor…</div>;
  }

  const onInsertLink = () => {
    const url = window.prompt("URL do link:", editor.getAttributes("link").href ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const onInsertImage = async (file: File) => {
    setUploading(true);
    try {
      const { key, publicUrl } = await uploadFn({ data: { nomeArquivo: file.name } });
      const { error } = await supabase.storage.from("midia").upload(key, file, { upsert: false });
      if (error) throw error;
      editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();
    } catch (e: any) {
      alert("Erro no upload: " + (e?.message ?? "desconhecido"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-border border-b-0 bg-card p-2">
        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito">
          <Bold className="h-4 w-4" />
        </Btn>
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico">
          <Italic className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título H2">
          <Heading2 className="h-4 w-4" />
        </Btn>
        <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título H3">
          <Heading3 className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
          <List className="h-4 w-4" />
        </Btn>
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          <ListOrdered className="h-4 w-4" />
        </Btn>
        <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação">
          <Quote className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn active={editor.isActive("link")} onClick={onInsertLink} title="Link">
          <LinkIcon className="h-4 w-4" />
        </Btn>
        <label className="flex cursor-pointer items-center rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Inserir imagem">
          <ImageIcon className="h-4 w-4" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) { onInsertImage(f); e.currentTarget.value = ""; } }}
          />
        </label>
        {uploading && <span className="text-xs text-muted-foreground">Enviando…</span>}
        <div className="ml-auto">
          <Btn active={showHtml} onClick={() => setShowHtml((s) => !s)} title="Ver HTML">
            <Code2 className="h-4 w-4" />
          </Btn>
        </div>
      </div>

      {showHtml ? (
        <textarea
          value={editor.getHTML()}
          onChange={(e) => {
            skipUpdateRef.current = true;
            editor.commands.setContent(e.target.value, { emitUpdate: false });
            skipUpdateRef.current = false;
            onChange(e.target.value);
          }}
          rows={20}
          className="w-full rounded-b-md border border-t-0 border-border bg-card px-3 py-3 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}

function Btn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={
        "rounded p-1.5 transition-colors " +
        (active ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}
