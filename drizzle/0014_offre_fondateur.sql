-- Le tarif à 29 € HT réservé par l'opératrice s'appelle « tarif fondateur »
-- depuis le 27 octobre 2026 ; « early adopter » désigne désormais les prix
-- publics jusqu'au 31 décembre 2026. La valeur est renommée, les lignes qui la
-- portent la gardent.
ALTER TYPE "public"."offre_organisation" RENAME VALUE 'early_adopter' TO 'fondateur';
