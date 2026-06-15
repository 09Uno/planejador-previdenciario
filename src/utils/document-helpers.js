const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
        ShadingType, Header, Footer, PageNumber, TableOfContents, PageBreak } = require('docx');
const fs = require('fs');

const CW = 9026;
const border = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const borders = { top: border, bottom: border, left: border, right: border };
const ACCENT = "1F3864";

function H1(t){ return new Paragraph({ heading: HeadingLevel.HEADING_1, children:[new TextRun(t)] }); }
function H2(t){ return new Paragraph({ heading: HeadingLevel.HEADING_2, children:[new TextRun(t)] }); }
function H3(t){ return new Paragraph({ heading: HeadingLevel.HEADING_3, children:[new TextRun(t)] }); }
function P(t, opts={}){
  const children = typeof t === 'string' ? [new TextRun(t)] : t;
  return new Paragraph({ children, spacing:{ after: 120 }, alignment: AlignmentType.JUSTIFIED, ...opts });
}
function B(t){ return new TextRun({ text: t, bold: true }); }
function R(t){ return new TextRun(t); }
function I(t){ return new TextRun({ text: t, italics: true }); }
function bullet(t, level=0){
  const children = typeof t === 'string' ? [new TextRun(t)] : t;
  return new Paragraph({ numbering:{ reference: "bullets", level }, children, spacing:{ after: 60 }, alignment: AlignmentType.JUSTIFIED });
}
function cell(content, opts={}){
  const paras = (Array.isArray(content)?content:[content]).map(c =>
    typeof c === 'string' ? new Paragraph({ children:[new TextRun({ text:c, size: 19, bold: !!opts.bold, color: opts.color })], spacing:{after:30} }) : c);
  return new TableCell({ borders, width:{ size: opts.w, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins:{ top:60, bottom:60, left:100, right:100 }, children: paras });
}
function table(widths, headerRow, rows){
  const trs = [];
  if(headerRow) trs.push(new TableRow({ tableHeader:true, children: headerRow.map((h,i)=>cell(h,{w:widths[i],fill:ACCENT,bold:true,color:"FFFFFF"})) }));
  rows.forEach(r => trs.push(new TableRow({ children: r.map((c,i)=>cell(c,{w:widths[i]})) })));
  return new Table({ width:{ size: widths.reduce((a,b)=>a+b,0), type: WidthType.DXA }, columnWidths: widths, rows: trs });
}
function pageBreak(){ return new Paragraph({ children:[new PageBreak()] }); }

function buildDoc(title, subtitle, children, outPath){
  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 21 } } },
      paragraphStyles: [
        { id:"Heading1", name:"Heading 1", basedOn:"Normal", next:"Normal", quickFormat:true,
          run:{ size:30, bold:true, font:"Arial", color: ACCENT },
          paragraph:{ spacing:{ before:280, after:160 }, outlineLevel:0 } },
        { id:"Heading2", name:"Heading 2", basedOn:"Normal", next:"Normal", quickFormat:true,
          run:{ size:25, bold:true, font:"Arial", color: ACCENT },
          paragraph:{ spacing:{ before:220, after:120 }, outlineLevel:1 } },
        { id:"Heading3", name:"Heading 3", basedOn:"Normal", next:"Normal", quickFormat:true,
          run:{ size:22, bold:true, font:"Arial", color:"404040" },
          paragraph:{ spacing:{ before:180, after:100 }, outlineLevel:2 } },
      ]
    },
    numbering: { config: [
      { reference:"bullets", levels:[
        { level:0, format:LevelFormat.BULLET, text:"•", alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:540, hanging:270 } } } },
        { level:1, format:LevelFormat.BULLET, text:"–", alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:1000, hanging:270 } } } } ] }
    ]},
    sections: [{
      properties: { page: { size:{ width:11906, height:16838 }, margin:{ top:1440, right:1440, bottom:1440, left:1440 } } },
      headers: { default: new Header({ children:[ new Paragraph({ alignment: AlignmentType.RIGHT,
        children:[ new TextRun({ text: title, size:16, color:"808080" }) ],
        border:{ bottom:{ style:BorderStyle.SINGLE, size:4, color:"CCCCCC", space:2 } } }) ] }) },
      footers: { default: new Footer({ children:[ new Paragraph({ alignment: AlignmentType.CENTER,
        children:[ new TextRun({ text:"Página ", size:16, color:"808080" }), new TextRun({ children:[PageNumber.CURRENT], size:16, color:"808080" }) ] }) ] }) },
      children: [
        new Paragraph({ spacing:{ before: 2400 }, alignment: AlignmentType.CENTER,
          children:[ new TextRun({ text: title, bold:true, size:44, color: ACCENT }) ] }),
        new Paragraph({ spacing:{ before: 200, after: 200 }, alignment: AlignmentType.CENTER,
          children:[ new TextRun({ text: subtitle, size:26, color:"404040" }) ] }),
        new Paragraph({ alignment: AlignmentType.CENTER,
          children:[ new TextRun({ text: "Junho de 2026", size:22, color:"808080" }) ] }),
        pageBreak(),
        new Paragraph({ children:[ new TextRun({ text:"Sumário", bold:true, size:28, color:ACCENT }) ], spacing:{ after:160 } }),
        new TableOfContents("Sumário", { hyperlink:true, headingStyleRange:"1-2" }),
        pageBreak(),
        ...children
      ]
    }]
  });
  return Packer.toBuffer(doc).then(buf => { fs.writeFileSync(outPath, buf); console.log("OK:", outPath); });
}

module.exports = { H1,H2,H3,P,B,R,I,bullet,cell,table,pageBreak,buildDoc,CW };
