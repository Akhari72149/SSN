type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

type QrCode = {
  addData(data: string, mode?: "Numeric" | "Alphanumeric" | "Byte" | "Kanji"): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, column: number): boolean;
};

declare function qrcode(typeNumber: number, errorCorrectionLevel: ErrorCorrectionLevel): QrCode;

export default qrcode;
