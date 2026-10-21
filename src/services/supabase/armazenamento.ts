// Onde a sessão de login fica guardada no celular: um banco local do próprio
// app (expo-sqlite), como recomenda o guia do Expo. Quando a entrada por
// digital for implementada, a sessão passa a ser criptografada.
import 'expo-sqlite/localStorage/install';

export const armazenamentoDaSessao = localStorage;
