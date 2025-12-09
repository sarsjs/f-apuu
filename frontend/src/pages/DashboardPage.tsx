import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Grid, Typography, CircularProgress, Box, Alert } from '@mui/material';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { apiFetch } from '../api/client';
import ChartWrapper from '../components/dashboard/ChartWrapper';

// --- Tipos y Colores ---
type DashboardData = {
    nombre_proyecto: string;
    costo_total_proyecto: number;
    desglose_por_tipo: { name: string; value: number }[];
    top_5_conceptos: { nombre: string; costo_total: number }[];
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

// --- Componente Principal ---
export default function DashboardPage() {
    const { projectId } = useParams<{ projectId: string }>();
    const [data, setData] = useState<DashboardData | null>(null);
    // ... (resto de la lógica de estado y fetching)

    // ... (lógica de loading, error, y no-data)

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Dashboard: {data.nombre_proyecto}</Typography>
            {/* ... */}
            <Grid container spacing={3} sx={{ mt: 2 }}>
                <Grid item xs={12} md={6} lg={5}>
                    <ChartWrapper title="Desglose de Costos por Tipo">
                        <PieChart>
                            <Pie data={data.desglose_por_tipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#8884d8" label>
                                {data.desglose_por_tipo.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`} />
                            <Legend />
                        </PieChart>
                    </ChartWrapper>
                </Grid>
                <Grid item xs={12} md={6} lg={7}>
                    <ChartWrapper title="Top 5 Conceptos Más Costosos">
                        <BarChart data={data.top_5_conceptos} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="nombre" width={150} tick={{ fontSize: 12 }} />
                            <Tooltip formatter={(value: number) => `$${value.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`} />
                            <Bar dataKey="costo_total" fill="#8884d8" />
                        </BarChart>
                    </ChartWrapper>
                </Grid>
            </Grid>
        </Container>
    );
}
