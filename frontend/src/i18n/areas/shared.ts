import { defineMessages } from '../define';

// Pieces used all over the app: the 404 page, error screens, the generic dialogs and the toasts of the closet.
export const shared = defineMessages(
  {
    'notfound.code': 'Error 404',
    'notfound.title': 'Page not found',
    'notfound.body': "The page you're looking for doesn't exist or may have moved.",
    'notfound.home': 'Back to home',

    'errorState.title': "We couldn't complete this action",
    'errorState.message': 'Something went wrong on our side. Please try again.',
    'errorState.retry': 'Try Again',

    'storageModal.label': 'Closet is full',
    'storageModal.title': 'Your closet is full',
    'storageModal.soon': 'Plans with more space are coming soon.',
    'storageModal.gotIt': 'Got it',

    'delete.title': 'Delete Garment?',
    'delete.body': 'Are you sure you want to remove <name>"{name}"</name>? This action is permanent and cannot be undone.',
    'delete.confirm': 'Confirm Deletion',
    'delete.deleted': 'Garment "{name}" deleted',
    'delete.failed': 'Failed to delete garment',

  },
  {
    'notfound.code': 'Error 404',
    'notfound.title': 'Página no encontrada',
    'notfound.body': 'La página que buscas no existe o pudo haberse movido.',
    'notfound.home': 'Volver al inicio',

    'errorState.title': 'No pudimos completar esta acción',
    'errorState.message': 'Algo salió mal de nuestro lado. Inténtalo de nuevo.',
    'errorState.retry': 'Intentar de nuevo',

    'storageModal.label': 'Tu clóset está lleno',
    'storageModal.title': 'Tu clóset está lleno',
    'storageModal.soon': 'Pronto habrá planes con más espacio.',
    'storageModal.gotIt': 'Entendido',

    'delete.title': '¿Eliminar prenda?',
    'delete.body': '¿Seguro que quieres quitar <name>"{name}"</name>? Esta acción es permanente y no se puede deshacer.',
    'delete.confirm': 'Confirmar eliminación',
    'delete.deleted': 'Prenda "{name}" eliminada',
    'delete.failed': 'No se pudo eliminar la prenda',

  },
);
