# Simulação de Fluidos com Detecção de Movimento por Webcam

Este projeto combina uma simulação de fluidos WebGL com detecção de movimento via webcam, permitindo que você interaja com o fluido usando os movimentos das suas mãos na frente da câmera.

## Como funciona

1. A webcam captura seu vídeo em tempo real
2. Um algoritmo de detecção de movimento analisa os quadros de vídeo para identificar movimentos
3. Quando há movimento das mãos, a simulação de fluido reage em tempo real, criando respingos e ondulações nas áreas onde o movimento foi detectado

![Prévia da simulação](https://via.placeholder.com/800x400?text=Prévia+da+Simulação)

## Funcionalidades

- Detecção de movimento em tempo real através da webcam
- Visualização do vídeo da webcam com realce dos pontos de movimento detectados
- Controles de ajuste para sensibilidade da detecção
- Diferentes modos de cor para o fluido
- Controles de densidade e velocidade do fluido
- Funciona em navegadores modernos, inclusive em dispositivos móveis

## Tecnologias utilizadas

- WebGL para renderização da simulação de fluidos
- JavaScript para processamento de imagem da webcam
- HTML5 e CSS3 para interface

## Como usar

1. Acesse a [demonstração online](https://kleberantunes.github.io/webcam-fluid-simulation/) ou clone o repositório e abra o arquivo `index.html` em seu navegador
2. Clique no botão "Iniciar Webcam" e permita o acesso à sua câmera quando solicitado
3. Movimente suas mãos na frente da câmera para interagir com o fluido
4. Use os controles para ajustar a sensibilidade, densidade e outras propriedades

## Ajustes de controle

- **Sensibilidade:** Controla quão sensível é a detecção de movimento (valores mais altos detectam movimentos menores)
- **Densidade do fluido:** Afeta quão rápido as cores do fluido se dissipam
- **Velocidade do fluido:** Controla quão rápido o fluido se move
- **Modo de cor:** Escolha entre diferentes esquemas de cores para a visualização

## Executando localmente

```bash
# Clone o repositório
git clone https://github.com/kleberantunes/webcam-fluid-simulation.git

# Entre na pasta do projeto
cd webcam-fluid-simulation

# Abra o arquivo index.html em seu navegador
# Para evitar restrições de segurança com a webcam, é recomendável usar um servidor local
# Python 3:
python -m http.server

# Ou se você tem Node.js:
npx serve
```

## Limitações

- Para melhor desempenho, use um navegador atualizado com suporte a WebGL2
- A detecção de movimento é baseada na diferença entre frames, então um fundo estático proporciona melhores resultados
- Em dispositivos com pouca potência computacional, a simulação pode apresentar lentidão

## Próximos passos

- Implementação de detecção de mãos com machine learning para maior precisão
- Suporte a múltiplos usuários/webcams
- Opções adicionais de visualização e efeitos

## Créditos

- Baseado na [WebGL Fluid Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation