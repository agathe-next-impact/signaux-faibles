-- L'espace réorganisé (lots 2 à 6 de docs/proposition-reorganisation-espace.md, 30 octobre 2026) :
-- faux par défaut, posé par l'opératrice ; pilote sur L'Hermitage.
ALTER TABLE "organisations" ADD COLUMN "espace_reorganise" boolean DEFAULT false NOT NULL;