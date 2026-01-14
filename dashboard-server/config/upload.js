const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Garantir que os diretórios existem
const uploadsDir = path.join(__dirname, '..', 'uploads');
const capasDir = path.join(uploadsDir, 'capas');
const materiasDir = path.join(uploadsDir, 'materias');
const pdfsDir = path.join(uploadsDir, 'pdfs');
const videosDir = path.join(uploadsDir, 'videos');

[uploadsDir, capasDir, materiasDir, pdfsDir, videosDir].forEach(dir => {
  fs.ensureDirSync(dir);
});

// Configuração para upload de capas
const storageCapas = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, capasDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `capa-${uniqueSuffix}${ext}`);
  }
});

// Configuração para upload de matérias
const storageMaterias = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, materiasDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `materia-${uniqueSuffix}${ext}`);
  }
});

// Configuração para upload de PDFs
const storagePdfs = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, pdfsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `jornal-${uniqueSuffix}.pdf`);
  }
});

// Configuração para upload de vídeos
const storageVideos = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videosDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `video-${uniqueSuffix}${ext}`);
  }
});

// Filtros de arquivo para imagens
const imageFilter = (req, file, cb) => {
  if (!file) {
    return cb(null, false); // Não aceitar se não houver arquivo
  }
  
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Apenas imagens são permitidas (jpeg, jpg, png, gif, webp)'));
  }
};

// Filtro de arquivo para PDFs
const pdfFilter = (req, file, cb) => {
  if (!file) {
    return cb(null, false);
  }
  
  const isPdf = file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf';
  
  if (isPdf) {
    return cb(null, true);
  } else {
    cb(new Error('Apenas arquivos PDF são permitidos'));
  }
};

// Filtro de arquivo para vídeos
const videoFilter = (req, file, cb) => {
  if (!file) {
    return cb(null, true); // Aceitar se não houver arquivo (opcional)
  }
  
  const allowedTypes = /mp4|webm|ogg|mov|avi|wmv|flv/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith('video/');
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Apenas vídeos são permitidos (mp4, webm, ogg, mov, avi, wmv, flv)'));
  }
};

// Uploaders - usando .single() mas com opção de não enviar arquivo
const uploadCapa = multer({
  storage: storageCapas,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFilter
});

const uploadMateria = multer({
  storage: storageMaterias,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFilter
});

const uploadPdf = multer({
  storage: storagePdfs,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250MB
  fileFilter: pdfFilter
});

const uploadVideo = multer({
  storage: storageVideos,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB para vídeos
  fileFilter: videoFilter
});

// Middleware customizado que permite arquivo opcional
// Aceita apenas o campo 'capa' e ignora outros campos de arquivo
const uploadCapaOptional = multer({
  storage: storageCapas,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageFilter
}).single('capa');

// Middleware para upload de múltiplos arquivos (capa e PDF)
// Limites: 10MB para imagens, 300KB para PDFs
const uploadJornalFilesMulter = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'capa') {
        cb(null, capasDir);
      } else if (file.fieldname === 'pdf') {
        cb(null, pdfsDir);
      } else {
        cb(new Error('Campo de arquivo inválido'));
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      if (file.fieldname === 'capa') {
        const ext = path.extname(file.originalname);
        cb(null, `capa-${uniqueSuffix}${ext}`);
      } else if (file.fieldname === 'pdf') {
        cb(null, `jornal-${uniqueSuffix}.pdf`);
      }
    }
  }),
  limits: {
    fileSize: 250 * 1024 * 1024 // 250MB máximo (para não bloquear PDFs grandes)
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'capa') {
      imageFilter(req, file, cb);
    } else if (file.fieldname === 'pdf') {
      pdfFilter(req, file, cb);
    } else {
      cb(new Error('Campo de arquivo inválido'));
    }
  }
}).fields([
  { name: 'capa', maxCount: 1 },
  { name: 'pdf', maxCount: 1 }
]);

// Middleware customizado que valida tamanho de PDF após upload
const uploadJornalFiles = (req, res, next) => {
  uploadJornalFilesMulter(req, res, (err) => {
    if (err) {
      return next(err);
    }
    
    // Validar tamanho do PDF após upload (250MB máximo)
    if (req.files && req.files.pdf && req.files.pdf[0]) {
      const pdfFile = req.files.pdf[0];
      const maxPdfSize = 250 * 1024 * 1024; // 250MB
      
      if (pdfFile.size > maxPdfSize) {
        // Deletar arquivo PDF que foi enviado
        const pdfPath = path.join(pdfsDir, pdfFile.filename);
        fs.remove(pdfPath).catch(() => {});
        
        return next(new Error('PDF muito grande. Tamanho máximo: 250MB'));
      }
    }
    
    // Validar tamanho da imagem (10MB máximo - já validado pelo Multer)
    if (req.files && req.files.capa && req.files.capa[0]) {
      const capaFile = req.files.capa[0];
      const maxImageSize = 10 * 1024 * 1024; // 10MB
      
      if (capaFile.size > maxImageSize) {
        // Deletar arquivo de imagem que foi enviado
        const capaPath = path.join(capasDir, capaFile.filename);
        fs.remove(capaPath).catch(() => {});
        
        return next(new Error('Imagem muito grande. Tamanho máximo: 10MB'));
      }
    }
    
    next();
  });
};

module.exports = {
  uploadCapa: uploadCapa.single('capa'),
  uploadCapaOptional: uploadCapaOptional,
  uploadMateria: uploadMateria.single('materia'),
  uploadPdf: uploadPdf.single('pdf'),
  uploadVideo: uploadVideo.single('video'),
  uploadJornalFiles: uploadJornalFiles
};
