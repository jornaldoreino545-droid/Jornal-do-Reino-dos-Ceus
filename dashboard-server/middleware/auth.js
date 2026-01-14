// Middleware de autenticação
// Protege rotas que requerem login com as credenciais corretas
function requireAuth(req, res, next) {
  console.log('=== VERIFICAÇÃO DE AUTENTICAÇÃO ===');
  console.log('Rota protegida:', req.method, req.path);
  console.log('Session ID:', req.sessionID);
  console.log('Autenticado:', req.session?.authenticated);
  console.log('User:', req.session?.user);
  console.log('====================================');
  
  // Verificar se a sessão existe e está autenticada
  if (req.session && req.session.authenticated === true) {
    // Verificar se o usuário é o admin autorizado
    const adminEmail = 'jornaldoreino545@gmail.com';
    const sessionUser = req.session.user;
    
    if (sessionUser && (sessionUser === adminEmail || sessionUser.toLowerCase() === adminEmail.toLowerCase())) {
      console.log('✅ Autenticação OK - Acesso autorizado para:', sessionUser);
      return next();
    } else {
      console.log('❌ Usuário não autorizado:', sessionUser);
      req.session.authenticated = false;
      return res.status(403).json({ 
        error: 'Acesso negado',
        message: 'Você não tem permissão para acessar este recurso'
      });
    }
  }
  
  console.log('❌ Acesso negado - não autenticado');
  res.status(401).json({ 
    error: 'Não autenticado',
    message: 'Você precisa fazer login com credenciais válidas para acessar este recurso'
  });
}

module.exports = { requireAuth };
