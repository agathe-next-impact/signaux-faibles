/**
 * L'édition n°6 de la veille Écosystème d'Infralliance, telle qu'elle a été
 * publiée le 21 octobre 2026 : « L'essentiel », les cinq axes, l'analyse.
 *
 * Cette fixture existe parce que les deux lettres de septembre gardées par les
 * tests précèdent la révision du §6 du 19 octobre 2026 : elles n'ont pas de
 * phrase-titre en gras, et c'est la phrase-titre qui délimite un fait
 * (`segmenterLesFaits`). Comme dans Notion, la phrase-titre ouvre le paragraphe
 * qui porte le fait. Phrases-titres, dates, niveaux et liens sont ceux de la
 * page ; les paragraphes sont abrégés et les encadrés réduits à leur première
 * phrase. Deux liens vers des fiches de procédure du Parlement européen, écrits
 * entre chevrons dans Notion à cause de leurs parenthèses, portent ici les
 * parenthèses encodées (%28, %29), le convertisseur Markdown ne lisant pas les
 * chevrons.
 */
import { markdownVersBlocs } from '@/lib/domaine/markdown'

export const PAGE_OCTOBRE = '400fe829ce71814fbdbee7b1756d66ba'
export const DATE_OCTOBRE = '2026-10-21'

export const MARKDOWN_OCTOBRE = `<callout><b>Note de méthode et corrections.</b> Cette sixième lettre couvre la période du 14 au 20 octobre 2026. Toutes les dates et tous les liens ont été lus dans des pages ouvertes le 21 octobre 2026.</callout>

# L'essentiel

- La commission spéciale de l'Assemblée a trié le 14 octobre 2026 les amendements de la loi de résilience, sans date de séance.
- L'ordre du jour arrêté le 20 octobre 2026 ne porte pas la loi de résilience avant le 18 novembre ; prochaine conférence le 27 octobre.
- Le Conseil de l'UE examine le 22 octobre 2026 le premier texte de compromis de la présidence irlandaise sur le Digital Networks Act.
- Le rapporteur du règlement européen sur le cloud a reçu Clever Cloud et evroc les 14 et 15 octobre 2026 ; avis LIBE nommé le 19.
- Le Conseil poursuit l'examen du règlement sur les marchés publics les 29 et 30 octobre 2026 ; le Parlement n'a toujours pas de rapporteur.
- Telehouse a annoncé le 20 octobre 2026 un module de 3 MW dédié à l'IA à Magny, portant le campus TH3 à 23 MW.
- Le Cigref a adopté le 15 octobre 2026 une feuille de route qui fait des relations fournisseurs l'un de ses trois programmes prioritaires.
- La première relève de l'appel à projets France 2030 sur les centres de données durables tombe le 29 octobre 2026.

# Actualités par axe

## ① Cadre européen de la souveraineté : CADA, franco-allemand, DNA — MOYEN

<b>Le groupe de travail Télécommunications du Conseil de l'Union européenne examine le 22 octobre 2026 le premier texte de compromis de la présidence irlandaise sur le Digital Networks Act.</b> La convocation, datée du 16 octobre, inscrit à l'ordre du jour la « présentation et discussion du premier texte de compromis de la présidence » sur les articles 1 à 12 et 87 à 114 du règlement, c'est-à-dire le champ, les objectifs, les définitions, la résilience, l'autorisation unique et les services.

Ce que cela change pour vous. C'est le premier texte de compromis sur le règlement qui refond le cadre des réseaux, et il commence par les définitions et la résilience. Ce sont les articles où se décide si l'interconnexion et le transport sont nommés. Le texte lui-même n'est pas public.

Source : [convocation du Conseil, CM 4581/26](https://data.consilium.europa.eu/doc/document/CM-4581-2026-INIT/en/pdf), ouverte le 21 octobre 2026. <b>Impact moyen.</b>

<b>Le rapporteur du règlement sur le cloud et l'intelligence artificielle a reçu deux opérateurs de cloud européens, et la commission des libertés civiles a nommé son rapporteur pour avis.</b> La fiche de procédure du Parlement européen porte, dans sa rubrique de transparence, trois rendez-vous déclarés par le rapporteur Diego Solier : evroc le 14 octobre, puis APELL et Clever Cloud le 15 octobre. La commission des libertés civiles a nommé Kristian Vigenin rapporteur pour avis le 19 octobre.

Ce que cela change pour vous. Après un exploitant de centres de données le 13 octobre, ce sont deux fournisseurs de cloud européens que le rapporteur a reçus. Aucune fédération d'opérateurs d'infrastructures physiques n'apparaît encore parmi les rendez-vous lus, et la liste est tronquée.

Sources : [fiche de procédure 2026/0138(COD)](https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2026/0138%28COD%29) et [sommaire d'Agence Europe du 16 octobre 2026](https://agenceurope.eu/en/bulletin/sommaire/13961), ouverts le 21 octobre 2026. <b>Impact moyen.</b>

<b>CISPE a publié le 20 octobre 2026 une réponse chiffrée à l'étude commandée par les hyperscalers américains sur le coût d'une sortie de leurs clouds.</b> Le billet, titré « 115 milliards d'euros pour partir, plus de 2 000 milliards pour rester », retourne l'estimation de l'ECIPE pour la CCIA. Les mots centres de données et infrastructures n'y figurent pas.

Source : [billet de CISPE du 20 octobre 2026](https://www.cispe.cloud/e115-billion-to-move-over-e2-trillion-to-stay/), ouvert le 21 octobre 2026. <b>Impact moyen.</b>

<callout><b>Rien de neuf sur le catalogue franco-allemand.</b> La liste des actualités de la direction générale des entreprises porte deux entrées de la période, et rien sur le catalogue de solutions souveraines annoncé le 17 juin.</callout>

## ② Cadre français : loi Résilience, SecNumCloud, SREN, PINM — MOYEN

<b>La commission spéciale de l'Assemblée nationale a examiné le mercredi 14 octobre 2026 les amendements de séance de la loi de résilience, mais aucune date de séance n'a été fixée depuis.</b> Le compte rendu de cette réunion, tenue à 14 h 45 sous la présidence de Philippe Latombe et déposé le 15 octobre, porte le tableau des amendements examinés au titre de l'article 88 du Règlement. La conférence des présidents du 20 octobre a arrêté un ordre du jour qui court jusqu'au 17 novembre : il est entièrement budgétaire.

Ce que cela change pour vous. Le texte est prêt pour la séance depuis le 14 octobre, et la séance n'a pas de date. Rien n'est opposable avant la promulgation, et les mots « point d'échange » ne sont toujours pas dans le texte de commission.

Sources : [compte rendu n° 4 de la commission spéciale](https://www.assemblee-nationale.fr/dyn/17/comptes-rendus/cscyber/l17cscyber2627004_compte-rendu.pdf), [ordre du jour arrêté le 20 octobre 2026](https://www.assemblee-nationale.fr/dyn/static/seance/conference.pdf) et [agenda de la commission spéciale](https://www.assemblee-nationale.fr/dyn/17/organes/cnps/cs-pjl-cybersecurite), ouverts le 21 octobre 2026. <b>Impact moyen.</b>

<b>Bleu, le cloud de confiance à technologie Microsoft, a annoncé le 15 octobre 2026 un partenariat avec Snowflake et Orange Business, en visant la qualification SecNumCloud 3.2.</b> Le billet de Snowflake présente une intention de partenariat pour les secteurs réglementés français, sans calendrier. Le 20 octobre, Silicon écrit que S3NS, le cloud de confiance à technologie Google, « a pour le moment 29 services qualifiés SecNumCloud ».

Ce que cela change pour vous. Les deux clouds de confiance à capital étranger avancent par annonces et par comptes de services, pendant que la liste officielle nous reste illisible.

Sources : [billet de Snowflake du 15 octobre 2026](https://www.snowflake.com/fr/blog/snowflake-bleu-sovereign-cloud-france/) et [Silicon, 20 octobre 2026](https://www.silicon.fr/cloud-1370/s3ns-clients-229762), ouverts le 21 octobre 2026. <b>Impact moyen.</b>

<callout><b>Rien de neuf sur les projets d'intérêt national majeur ni sur Rovaltain.</b> Aucun décret d'application de l'article 35 de la loi du 26 mai 2026 n'est remonté par la recherche.</callout>

## ③ Commande publique et préférence européenne — MOYEN

<b>Le groupe de travail du Conseil sur les marchés publics poursuit l'examen du règlement unique les 29 et 30 octobre 2026, avec un débat sur la forme juridique du texte.</b> La convocation du 15 octobre inscrit, sur deux jours, la « poursuite de l'examen de la proposition » de règlement sur les contrats publics et les concessions, et, le 29 après-midi, un « débat thématique : forme juridique ».

Ce que cela change pour vous. Le Conseil avance quand le Parlement n'a pas commencé. Les services numériques ne sont toujours ni nommés ni exclus.

Sources : [convocation du Conseil, CM 4602/26](https://data.consilium.europa.eu/doc/document/CM-4602-2026-INIT/en/pdf) et [fiche de procédure 2026/0265(COD)](https://oeil.europarl.europa.eu/oeil/en/procedure-file?reference=2026/0265%28COD%29), ouvertes le 21 octobre 2026. <b>Impact moyen.</b>

<callout><b>Rien de neuf du côté de la préférence industrielle ni des fédérations.</b> France Industrie a publié le 15 octobre sur l'automobile, rien sur les marchés publics.</callout>

## ④ Datacenters, énergie, raccordement, acceptabilité — FORT

<b>Telehouse a annoncé le 20 octobre 2026 un nouveau module de 3 MW dédié à l'intelligence artificielle sur son campus TH3 Paris Magny, dont la puissance disponible passe à 23 MW.</b> Le communiqué décrit une infrastructure compatible avec la haute densité et le refroidissement liquide direct, « désormais opérationnelle ». Le texte ne dit rien du raccordement électrique du site ni d'Infralliance.

Ce que cela change pour vous. C'est un fait qui touche le site d'un fondateur, et c'est pour cela que nous le classons au niveau fort.

Source : [communiqué de Telehouse du 20 octobre 2026](https://www.telehouse.fr/actualites/telehouse-renforce-les-capacites-ia-de-son-campus-th3-paris-magny-avec-le-deploiement-dune-nouvelle-infrastructure-dediee-a-lintelligence-artificielle-et-a-linterconnexion/), ouvert le 21 octobre 2026. <b>Impact fort.</b>

<b>L'agglomération de Cambrai a approuvé une seconde fois, selon DCmag le 19 octobre 2026, la vente des terrains du projet e-Valley de Data4 et Brookfield.</b> L'article donne une puissance d'un gigawatt à terme, et un raccordement par « environ 29 km de réseau souterrain » depuis deux postes sources, dont les travaux ne sont prévus qu'en 2027.

Ce que cela change pour vous. Un projet d'un gigawatt dans le Nord avance par le foncier avant le réseau. Le raccordement reste le goulot, et il est daté.

Source : [DCmag, 19 octobre 2026](https://dcmag.fr/), ouvert le 21 octobre 2026. <b>Impact moyen.</b>

<b>Deux avocats ont dressé le 15 octobre 2026, dans DCmag, l'état de la jurisprudence récente sur les recours contre les centres de données.</b> Trois affaires y sont décrites : la suspension en référé du permis d'Alixan par le tribunal administratif de Grenoble le 10 juillet, la validation par la cour administrative d'appel de Versailles, le 2 avril, du découpage en trois phases du projet de Wissous, et les recours en cours contre Fouju.

Ce que cela change pour vous. Le juge lit désormais la puissance totale d'un campus, et le raccordement devient un moyen de recours.

Source : [DCmag, 15 octobre 2026](https://www.dcmag.fr/recours-contentieux-contre-les-projets-de-data-centers-etat-des-lieux-de-la-jurisprudence-recente/), ouvert le 21 octobre 2026. <b>Impact moyen.</b>

<callout><b>Rien de neuf sur les règles de raccordement.</b> L'espace presse de RTE a publié le 14 octobre deux communiqués, sans règle de priorisation.</callout>

## ⑤ Filière, fédérations et financement public — MOYEN

<b>Le Cigref a dévoilé le 15 octobre 2026, lors de son assemblée générale, une feuille de route 2026-2027 dont l'un des trois programmes prioritaires est « Relations fournisseurs ».</b> Le compte rendu de l'association des grandes entreprises utilisatrices présente sept programmes, dont trois prioritaires : sécurité numérique, intelligence artificielle et relations fournisseurs. Son président Emmanuel Sardet invite à « questionner des dépendances ».

Ce que cela change pour vous. La voix des acheteurs organise sa pression sur les fournisseurs, et c'est son étude que CISPE reprend le 20 octobre.

Sources : [assemblée générale du Cigref](https://www.cigref.fr/assemblee-generale-du-cigref-2026-trajectoires-numeriques-competitivite-et-performance) et [rapport d'orientation 2026](https://www.cigref.fr/rapport-dorientation-strategique-2026-du-cigref-de-la-prospective-a-laction-recommandations-strategiques-pour-2040), ouverts le 21 octobre 2026. <b>Impact moyen.</b>

<b>Aymeric Renaud, président de Schneider Electric France, a été nommé président du GIMELEC, selon DCmag le 14 octobre 2026.</b> Il succède à Laurent Bataille. Le GIMELEC est co-titulaire, avec France Datacenter, de la mission sur la préfabrication des infrastructures numériques confiée par le Gouvernement le 9 juillet.

Source : [DCmag, 14 octobre 2026](https://dcmag.fr/aymeric-renaud-president-du-gimelec/), ouvert le 21 octobre 2026. <b>Impact moyen.</b>

<callout><b>Rien de neuf chez les autres fédérations ni sur les guichets.</b> L'appel à projets France 2030 sur les centres de données plus durables confirme une première relève le 29 octobre 2026.</callout>

# L'analyse de la semaine : le texte est prêt, la séance ne l'est pas

Deux choses se sont passées en même temps cette semaine, et elles se contredisent. D'un côté, la commission spéciale a fait le 14 octobre le dernier geste qui précède une séance publique. De l'autre, la conférence des présidents a arrêté le 20 octobre un mois entier de budget, sans ce texte.
`

export const BLOCS_OCTOBRE = markdownVersBlocs(MARKDOWN_OCTOBRE)
