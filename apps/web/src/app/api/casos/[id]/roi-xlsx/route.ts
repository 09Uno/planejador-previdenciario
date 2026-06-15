import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const caso = await prisma.caso.findUnique({
    where: { id },
    include: { cenarios: { orderBy: { criadoEm: 'asc' } } },
  });

  if (!caso) return NextResponse.json({ erro: 'Caso não encontrado' }, { status: 404 });

  const cenariosComROI = caso.cenarios
    .map(c => {
      const resultado = JSON.parse(c.resultadoJson);
      return { rotulo: c.rotulo, resultado };
    })
    .filter(c => c.resultado.roi);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'MFAA — Planejador Previdenciário';
  wb.created = new Date();

  const ws = wb.addWorksheet('ROI Previdenciário');

  // Header
  ws.mergeCells('A1:H1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `ROI PREVIDENCIÁRIO — ${caso.clienteNome}`;
  titleCell.font = { bold: true, size: 14, color: { argb: 'FF1F3864' } };
  titleCell.alignment = { horizontal: 'center' };

  if (caso.status !== 'aprovado') {
    ws.mergeCells('A2:H2');
    const minutaCell = ws.getCell('A2');
    minutaCell.value = 'MINUTA — requer conferência do advogado';
    minutaCell.font = { bold: true, size: 11, color: { argb: 'FFDC2626' } };
    minutaCell.alignment = { horizontal: 'center' };
  }

  let row = 4;

  // Gerar blocos comparativos
  for (let i = 0; i < cenariosComROI.length; i++) {
    const c = cenariosComROI[i];
    const roi = c.resultado.roi;

    ws.getCell(`A${row}`).value = `Cenário ${i + 1}: ${c.rotulo}`;
    ws.getCell(`A${row}`).font = { bold: true, size: 11, color: { argb: 'FF1F3864' } };
    row++;

    const campos = [
      ['DER / DIB', roi.dataAposentadoria],
      ['Idade na DER', `${roi.idadeNaDER.toFixed(1)} anos`],
      ['Expectativa de sobrevida', `${roi.expectativaSobrevidaNaDER} anos`],
      ['RMI Bruta', roi.rmiBruta],
      ['IR Mensal (até 65)', roi.irMensalAte65],
      ['RMI Líquida (até 65)', roi.rmiLiquidaAte65],
      ['Anos até 65', roi.anosAte65],
      ['Ganho até 65', roi.ganhoAte65],
      ['IR Mensal (após 65)', roi.irMensalApos65],
      ['RMI Líquida (após 65)', roi.rmiLiquidaApos65],
      ['Sobrevida após 65', `${roi.sobrevidaApos65} anos`],
      ['Ganho após 65', roi.ganhoApos65],
      ['Ganho Total', roi.ganhoTotal],
      ['Total Contribuições', roi.totalContribuicoes],
      ['Débito a quitar', roi.debitoQuitar],
      ['Aposentadoria que deixará de receber', roi.beneficioNaoRecebido],
      ['Total Investimentos', roi.totalInvestimentos],
      ['ROI PREVIDENCIÁRIO LÍQUIDO', roi.roiLiquido],
    ];

    for (const [label, value] of campos) {
      ws.getCell(`A${row}`).value = label;
      ws.getCell(`A${row}`).font = { bold: label === 'ROI PREVIDENCIÁRIO LÍQUIDO' };
      const valCell = ws.getCell(`B${row}`);
      if (typeof value === 'number') {
        valCell.value = value;
        valCell.numFmt = '#,##0.00';
      } else {
        valCell.value = value;
      }
      if (label === 'ROI PREVIDENCIÁRIO LÍQUIDO') {
        valCell.font = { bold: true, size: 12, color: { argb: value >= 0 ? 'FF16A34A' : 'FFDC2626' } };
      }
      row++;
    }

    row += 2;
  }

  // Tabela comparativa
  if (cenariosComROI.length >= 2) {
    ws.getCell(`A${row}`).value = 'COMPARATIVO';
    ws.getCell(`A${row}`).font = { bold: true, size: 12, color: { argb: 'FF1F3864' } };
    row++;

    ws.getCell(`A${row}`).value = 'Cenário';
    ws.getCell(`B${row}`).value = 'ROI Líquido';
    ws.getCell(`A${row}`).font = { bold: true };
    ws.getCell(`B${row}`).font = { bold: true };
    row++;

    for (const c of cenariosComROI) {
      ws.getCell(`A${row}`).value = c.rotulo;
      ws.getCell(`B${row}`).value = c.resultado.roi.roiLiquido;
      ws.getCell(`B${row}`).numFmt = '#,##0.00';
      row++;
    }
  }

  // Ajustar larguras
  ws.getColumn('A').width = 40;
  ws.getColumn('B').width = 20;

  const buffer = await wb.xlsx.writeBuffer();

  const hoje = new Date();
  const dataStr = `${hoje.getFullYear()}${String(hoje.getMonth() + 1).padStart(2, '0')}${String(hoje.getDate()).padStart(2, '0')}`;
  const nomeArquivo = `${dataStr}-roi-${caso.clienteNome.replace(/\s+/g, '-').toLowerCase()}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
    },
  });
}
