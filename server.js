const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let perguntasRodada = [];
const progressoAlunos = {};
let contadorRespostas = 0;

// Objeto para armazenar os logins e o status (online/offline)
const ultimosLogins = {}; 

app.use(express.static('public'));

// Limpador automático: roda a cada 30 segundos removendo quem saiu há mais de 10 minutos
setInterval(() => {
    const agora = Date.now();
    const DEZ_MINUTOS = 10 * 60 * 1000;

    let alteracao = false;
    for (let email in ultimosLogins) {
        const aluno = ultimosLogins[email];
        if (!aluno.online && (agora - aluno.ultimoAcesso > DEZ_MINUTOS)) {
            delete ultimosLogins[email];
            alteracao = true;
        }
    }

    if (alteracao) {
        io.emit('atualizar_lista_logins', Object.values(ultimosLogins));
    }
}, 30000);

io.on('connection', (socket) => {
    console.log('Um usuário se conectou:', socket.id);

    // [NOVO] Quando o professor entra, envia a lista atual de alunos imediatamente
    socket.on('professor_solicita_logins', () => {
        socket.emit('atualizar_lista_logins', Object.values(ultimosLogins));
    });

    // Quando o aluno faz login/entra na sala
    socket.on('aluno_logou', (dados) => {
        socket.emailAluno = dados.email;
        
        ultimosLogins[dados.email] = {
            nome: dados.nome || dados.email,
            email: dados.email,
            online: true,
            ultimoAcesso: Date.now()
        };

        // Transmite a lista atualizada para os professores
        io.emit('atualizar_lista_logins', Object.values(ultimosLogins));
    });

    socket.on('iniciar_rodada_perguntas', (dados) => {
        perguntasRodada = dados.perguntas;
        for (let id in progressoAlunos) progressoAlunos[id] = 0;
        io.emit('jogo_iniciado', { primeiraPergunta: perguntasRodada[0] });
    });

    socket.on('aluno_entrou', () => {
        if (perguntasRodada.length > 0) {
            progressoAlunos[socket.id] = 0;
            socket.emit('receber_pergunta_aluno', { pergunta: perguntasRodada[0], indice: 0, fim: false });
        }
    });

    socket.on('enviar_resposta', (dados) => {
        const indiceAtual = progressoAlunos[socket.id] || 0;
        contadorRespostas++;
        
        io.emit('nova_resposta_professor', {
            id_resposta: `resp-${contadorRespostas}`,
            id_aluno: socket.id,
            nome: dados.nome,
            resposta: dados.resposta,
            pergunta: perguntasRodada[indiceAtual],
            indice_pergunta: indiceAtual
        });
    });

    socket.on('decisao_professor', (dados) => {
        if (dados.aprovado) {
            progressoAlunos[dados.id_aluno] = (progressoAlunos[dados.id_aluno] || 0) + 1;
            const proximoIndice = progressoAlunos[dados.id_aluno];

            if (proximoIndice < perguntasRodada.length) {
                io.to(dados.id_aluno).emit('resultado_avaliacao', { aprovado: true, fim: false, proximaPergunta: perguntasRodada[proximoIndice], indice: proximoIndice });
            } else {
                io.to(dados.id_aluno).emit('resultado_avaliacao', { aprovado: true, fim: true });
            }
        } else {
            io.to(dados.id_aluno).emit('resultado_avaliacao', { aprovado: false });
        }
    });

    socket.on('disconnect', () => {
        if (socket.emailAluno && ultimosLogins[socket.emailAluno]) {
            ultimosLogins[socket.emailAluno].online = false;
            ultimosLogins[socket.emailAluno].ultimoAcesso = Date.now();
            
            io.emit('atualizar_lista_logins', Object.values(ultimosLogins));
        }
        delete progressoAlunos[socket.id];
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Jogo rodando na porta ${PORT}`));
