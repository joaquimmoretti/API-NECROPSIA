require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Variáveis de ambiente
const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;
const DROPBOX_FOLDER = process.env.DROPBOX_FOLDER;
const PDFSHIFT_API_KEY = process.env.PDFSHIFT_API_KEY;

// Rota de saúde
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Servidor Necropsia está funcionando!' });
});

// Rota para salvar PDF no Dropbox
app.post('/api/save-pdf', async (req, res) => {
    try {
        const { pdfBlob, fileName } = req.body;

        if (!pdfBlob || !fileName) {
            return res.status(400).json({ 
                success: false, 
                message: 'Faltam dados: pdfBlob e fileName são obrigatórios' 
            });
        }

        // Converter base64 para buffer
        const buffer = Buffer.from(pdfBlob, 'base64');

        // Caminho completo no Dropbox
        const filePath = `${DROPBOX_FOLDER}/${fileName}`;

        // Enviar para Dropbox
        const dropboxResponse = await axios.post(
            'https://content.dropboxapi.com/2/files/upload',
            buffer,
            {
                headers: {
                    'Authorization': `Bearer ${DROPBOX_TOKEN}`,
                    'Dropbox-API-Arg': JSON.stringify({
                        path: filePath,
                        mode: 'add',
                        autorename: true,
                        mute: false
                    }),
                    'Content-Type': 'application/octet-stream'
                }
            }
        );

        res.json({
            success: true,
            message: 'PDF salvo com sucesso no Dropbox!',
            data: dropboxResponse.data
        });

    } catch (error) {
        console.error('Erro ao salvar PDF:', error.message);
        res.status(500).json({
            success: false,
            message: 'Erro ao salvar PDF no Dropbox',
            error: error.message
        });
    }
});

// Rota para gerar PDF via pdfshift.io
app.post('/api/generate-pdf', async (req, res) => {
    try {
        const { htmlContent } = req.body;

        if (!htmlContent) {
            return res.status(400).json({
                success: false,
                message: 'htmlContent é obrigatório'
            });
        }

        // Gerar PDF via pdfshift.io
        const pdfResponse = await axios.post(
            'https://api.pdfshift.io/v3/convert/pdf',
            {
                source: htmlContent,
                landscape: false,
                use_print: true,
                margin: {
                    top: '20',
                    right: '20',
                    bottom: '20',
                    left: '20'
                }
            },
            {
                headers: {
                    'X-API-Key': PDFSHIFT_API_KEY,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        // Converter para base64
        const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');

        res.json({
            success: true,
            message: 'PDF gerado com sucesso!',
            pdfBlob: pdfBase64
        });

    } catch (error) {
        console.error('Erro ao gerar PDF:', error.message);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar PDF',
            error: error.message
        });
    }
});

// Rota para gerar E salvar PDF (tudo em uma chamada)
app.post('/api/generate-and-save-pdf', async (req, res) => {
    try {
        const { htmlContent, fileName } = req.body;

        if (!htmlContent || !fileName) {
            return res.status(400).json({
                success: false,
                message: 'htmlContent e fileName são obrigatórios'
            });
        }

        // Gerar PDF via pdfshift.io
        const pdfResponse = await axios.post(
            'https://api.pdfshift.io/v3/convert/pdf',
            {
                source: htmlContent,
                landscape: false,
                use_print: true,
                margin: {
                    top: '20',
                    right: '20',
                    bottom: '20',
                    left: '20'
                }
            },
            {
                headers: {
                    'X-API-Key': PDFSHIFT_API_KEY,
                    'Content-Type': 'application/json'
                },
                responseType: 'arraybuffer'
            }
        );

        // Salvar no Dropbox
        const filePath = `${DROPBOX_FOLDER}/${fileName}`;
        const dropboxResponse = await axios.post(
            'https://content.dropboxapi.com/2/files/upload',
            pdfResponse.data,
            {
                headers: {
                    'Authorization': `Bearer ${DROPBOX_TOKEN}`,
                    'Dropbox-API-Arg': JSON.stringify({
                        path: filePath,
                        mode: 'add',
                        autorename: true,
                        mute: false
                    }),
                    'Content-Type': 'application/octet-stream'
                }
            }
        );

        // Converter para base64 para retornar ao cliente
        const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');

        res.json({
            success: true,
            message: 'PDF gerado e salvo com sucesso!',
            pdfBlob: pdfBase64,
            dropboxData: dropboxResponse.data
        });

    } catch (error) {
        console.error('Erro ao gerar e salvar PDF:', error.message);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar e salvar PDF',
            error: error.message
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor Necropsia rodando em http://localhost:${PORT}`);
    console.log(`📁 Pasta Dropbox: ${DROPBOX_FOLDER}`);
    console.log(`🔐 Token Dropbox configurado: ${DROPBOX_TOKEN.substring(0, 20)}...`);
});
