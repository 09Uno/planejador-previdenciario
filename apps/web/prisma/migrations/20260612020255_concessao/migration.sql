-- CreateTable
CREATE TABLE "Concessao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "casoId" TEXT NOT NULL,
    "dib" TEXT,
    "rmiConcedida" REAL,
    "especie" TEXT,
    "ddb" TEXT,
    "cartaJson" TEXT,
    "divergencias" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Concessao_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Concessao_casoId_key" ON "Concessao"("casoId");
