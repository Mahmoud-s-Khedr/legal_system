declare module "html-to-docx" {
  export default function htmlToDocx(
    htmlString: string,
    headerHtmlString?: string,
    documentOptions?: Record<string, unknown>
  ): Promise<Buffer | Uint8Array | ArrayBuffer>;
}
