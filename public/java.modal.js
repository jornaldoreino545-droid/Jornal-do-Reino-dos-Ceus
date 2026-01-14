    const closeModal = document.getElementById("closeModal");
    const overlay = document.getElementById("overlay");

    // O modal será aberto pelo script de carregamento dinâmico se o banner estiver ativo
    // Não abrir automaticamente aqui para evitar conflito

    // Fecha clicando no "X"
    if (closeModal) {
      closeModal.addEventListener("click", () => {
        if (overlay) {
          overlay.classList.remove("active");
        }
      });
    }

    // Fecha clicando fora do modal
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.classList.remove("active");
        }
      });
    }