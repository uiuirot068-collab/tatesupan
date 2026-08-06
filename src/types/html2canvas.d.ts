declare module "html2canvas" {
  interface Html2CanvasOptions {
    scale: number;
    useCORS: boolean;
    allowTaint: boolean;
    backgroundColor: string | null;
    logging: boolean;
    width: number;
    height: number;
  }

  const html2canvas: (
    element: HTMLElement,
    options?: Partial<Html2CanvasOptions>
  ) => Promise<HTMLCanvasElement>;

  export default html2canvas;
}
