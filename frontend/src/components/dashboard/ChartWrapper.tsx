import React, { type ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import { Paper, Typography } from '@mui/material';

type ChartWrapperProps = {
    title: string;
    children: ReactNode;
};

export default function ChartWrapper({ title, children }: ChartWrapperProps) {
    return (
        <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" component="h3" gutterBottom>
                {title}
            </Typography>
            <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer>
                    {children}
                </ResponsiveContainer>
            </div>
        </Paper>
    );
}
