
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const extractFromPDF = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async function () {
      try {
        const typedarray = new Uint8Array(this.result);

        const pdf = await pdfjsLib.getDocument(typedarray).promise;

        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();

          const strings = content.items.map(item => item.str);
          fullText += strings.join(" ") + "\n";
        }

        resolve(fullText); // ✅ return text
      } catch (err) {
        reject(err);
      }
    };

    reader.readAsArrayBuffer(file);
  });
};

