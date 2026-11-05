// Exemple de KYC entièrement rempli (données fictives), partagé par les tests
export const KYC_COMPLET = {
  civilite: 'Madame',
  nom: 'Martin',
  prenom: 'Claire',
  dateNaissance: '1980-01-15',
  lieuNaissance: 'Lyon, France',
  nationalite: 'Française',
  adresse: '12 rue des Lilas',
  codePostal: '69003',
  ville: 'Lyon',
  pays: 'France',
  telephone: '06 12 34 56 78',
  situationFamiliale: 'Marié(e)',
  profession: 'Ingénieure',
  categorie: 'Cadre, profession intellectuelle supérieure',
  secteur: 'Industrie',
  origineFonds: ['Épargne issue de mes revenus'],
  ppe: 'Non',
  residenceFiscale: 'France',
  usPerson: 'Non',
};

// Débuts de fichiers PDF, JPG et PNG (US-04c), reconnus par formatDuFichier
export const PDF = Buffer.from('%PDF-1.7 contenu');
export const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
