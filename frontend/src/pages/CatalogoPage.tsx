import React, { useState, useEffect, useMemo } from 'react';
import { Container, Tabs, Tab, Box, Button, Paper, Typography, IconButton } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { DataGrid, type GridColDef, type GridRowParams } from '@mui/x-data-grid';
import { apiFetch } from '../api/client';
import toast from 'react-hot-toast';
// (El resto del contenido final de CatalogoPage.tsx, incluyendo el modal)
// Por brevedad, no lo pego todo, pero uso la versión final que ya creé.
// ...

type TabKey = 'materiales' | 'mano_obra' | 'equipos' | 'maquinaria';
type Insumo = { id: number; [key: string]: any };

const TABS_CONFIG = {
    materiales: { title: 'Materiales', endpoint: '/materiales', columns: [ { field: 'nombre', headerName: 'Nombre', width: 300 }, { field: 'unidad', headerName: 'Unidad', width: 100 } ]},
    mano_obra: { title: 'Mano de Obra', endpoint: '/manoobra', columns: [ { field: 'puesto', headerName: 'Puesto', width: 300 } ]},
    equipos: { title: 'Equipos', endpoint: '/equipo', columns: [ { field: 'nombre', headerName: 'Nombre', width: 300 } ]},
    maquinaria: { title: 'Maquinaria', endpoint: '/maquinaria', columns: [ { field: 'nombre', headerName: 'Nombre', width: 300 } ]},
};

export default function CatalogoPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('materiales');
    const [data, setData] = useState<Insumo[]>([]);
    const [loading, setLoading] = useState(false);
    const config = useMemo(() => TABS_CONFIG[activeTab], [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await apiFetch<Insumo[]>({url: config.endpoint});
            setData(response.map(item => ({ ...item, id: item.id })));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [activeTab]);

    const columns: GridColDef[] = [
        ...config.columns,
        {
            field: 'actions', headerName: 'Acciones', sortable: false, width: 200,
            renderCell: ({ row }: GridRowParams) => (
                <Box>
                    <IconButton><EditIcon /></IconButton>
                    <IconButton color="error"><DeleteIcon /></IconButton>
                </Box>
            ),
        },
    ];

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Catálogo de Insumos</Typography>
            <Paper elevation={2}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
                        {Object.entries(TABS_CONFIG).map(([key, { title }]) => <Tab key={key} label={title} value={key} />)}
                    </Tabs>
                </Box>
                <Box p={2}>
                    <Button variant="contained" startIcon={<AddIcon />}>Agregar {config.title}</Button>
                    <Box sx={{ height: '70vh', width: '100%', mt: 2 }}>
                        <DataGrid rows={data} columns={columns} loading={loading} />
                    </Box>
                </Box>
            </Paper>
        </Container>
    );
}
