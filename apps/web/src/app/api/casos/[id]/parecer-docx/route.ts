import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { gerarParecer, type DadosParecer } from '@mfaa/doc-gen';
import {
  parseBR, fmtAMD, idadeAMD, mesclarPeriodos, diasAte, diasParaAMD,
  avaliarRegras, auditarCNIS, comparativosEncadeados,
  VESPERA,
  type Periodo, type Sexo, type ResultadoCNIS, type Pendencia,
  type ResultadoROI,
} from '@mfaa/prev-engine';

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
  if (!caso.periodosJson) return NextResponse.json({ erro: 'Sem períodos confirmados' }, { status: 400 });

  // Períodos e regras
  const periodos: { ini: string; fim: string; desc?: string }[] = JSON.parse(caso.periodosJson);
  const merged: Periodo[] = mesclarPeriodos(
    periodos.map(p => ({ ini: parseBR(p.ini)!, fim: parseBR(p.fim)!, desc: p.desc }))
  );
  const nasc = parseBR(caso.nascimento)!;
  const hoje = Date.now();

  const diasVesp = diasAte(merged, VESPERA);
  const tcVespera = fmtAMD(diasParaAMD(diasVesp));
  const idadeVesp = idadeAMD(nasc, VESPERA);
  const idadeVespera = `${idadeVesp.y} ano(s), ${idadeVesp.m} mês(es) e ${idadeVesp.d} dia(s)`;

  const av = avaliarRegras({
    sexo: caso.sexo as Sexo, nasc, merged, hoje, continuaContribuindo: true,
  });

  // Auditoria
  let pendencias: Pendencia[] = [];
  if (caso.cnisJson) {
    pendencias = auditarCNIS(JSON.parse(caso.cnisJson) as ResultadoCNIS);
  }

  // Cenários selecionados
  const cenariosSelecionados = caso.cenarios
    .map(c => {
      const resultado = JSON.parse(c.resultadoJson);
      const premissas = JSON.parse(c.premissasJson);
      return { rotulo: c.rotulo, resultado, premissas };
    })
    .filter(c => c.premissas.selecionado);

  let docCount = 2;
  const cenariosParecer = cenariosSelecionados.map(c => {
    const docNum = `${docCount++}.1`;
    const regra = av.regras.find(r => r.id === c.resultado.regra) ?? av.regras[0];
    return {
      docNum,
      rotulo: c.rotulo,
      regra,
      dib: c.resultado.dib,
      idadeNaDIB: c.resultado.idadeNaDIB,
      tcNaDIB: c.resultado.tcNaDIB,
      tcDias: c.resultado.tcDias,
      carenciaNaDIB: c.resultado.carenciaNaDIB,
      mesesProjetados: c.resultado.mesesProjetados,
      contribuicaoMensal: c.resultado.contribuicaoMensal,
      rmi: c.resultado.rmi,
      roi: c.resultado.roi,
    };
  });

  // Comparativos
  const rois: ResultadoROI[] = cenariosParecer.filter(c => c.roi).map(c => c.roi!);
  const comparativos = comparativosEncadeados(rois);

  const dados: DadosParecer = {
    clienteNome: caso.clienteNome,
    sexo: caso.sexo as Sexo,
    nascimento: caso.nascimento,
    tcVespera,
    idadeVespera,
    regras: av.regras,
    cenarios: cenariosParecer,
    comparativos,
    pendencias,
    minuta: caso.status !== 'aprovado',
  };

  const buffer = await gerarParecer(dados);

  const dataStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const nomeArquivo = `${dataStr}-parecer-${caso.clienteNome.replace(/\s+/g, '-').toLowerCase()}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
    },
  });
}
