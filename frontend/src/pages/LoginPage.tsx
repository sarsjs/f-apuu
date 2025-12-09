import React, { useState } from 'react';
import { Container, Paper, Box, Typography, TextField, Button, InputAdornment, Alert, CircularProgress } from '@mui/material';
import { Lock, AccountCircle, ArrowForward } from '@mui/icons-material';
import { UserInfo } from '../types/user';
import { apiFetch } from '../api/client';

export default function LoginPage({ onLogin }: { onLogin: (user: UserInfo) => void }) {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('admin123');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const data = await apiFetch<any>({
                url: '/auth/login',
                method: 'POST',
                data: { username, password },
            });
            onLogin(data.user);
        } catch (err) {
            setError('Credenciales incorrectas o error del servidor.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs" sx={{ display: 'flex', alignItems: 'center', minHeight: '100vh' }}>
            <Paper elevation={6} sx={{ p: 4, width: '100%', borderRadius: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                    <Typography component="h1" variant="h5">Login</Typography>
                </Box>
                <Box component="form" onSubmit={handleSubmit} noValidate>
                    <TextField margin="normal" required fullWidth id="username" label="Username" name="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
                    <TextField margin="normal" required fullWidth name="password" label="Password" type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={isLoading}>
                        {isLoading ? <CircularProgress size={24} /> : 'Ingresar'}
                    </Button>
                </Box>
            </Paper>
        </Container>
    );
}
