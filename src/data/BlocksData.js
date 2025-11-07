export const blocks = [
    {
        id: 'motion_start',
        category: 'Motion',
        type: 'start-block',
        labels: [
            {
                text: 'start',
                pos: [24, 38]
            }
        ],
        size: ['+', 10],
        fields: []
    },
    
    {
        id: 'motion_move_steps',
        category: 'Motion',
        type: 'default-block',
        labels: [
            {
                text: 'move',
                pos: [24, 28]
            }
        ],
        size: null,
        fields: [
            {
                id: 'steps',
                type: 'Number',
                default: 10,
                pos: [90, 20]
            }
        ]
    },

    {
        id: 'control_repeat',
        category: 'Control',
        type: 'c-block',
        labels: [
            {
                text: 'repeat',
                pos: [24, 28]
            },
            {
                text: 'times',
                pos: [54, 28]
            }
        ],
        size: null,
        fields: [
            {
                id: 'times',
                type: 'Number',
                default: 10,
                pos: [110, 20]
            }
        ]
    },

    {
        id: 'control_stop',
        category: 'Control',
        type: 'stop-block',
        labels: [
            {
                text: 'stop',
                pos: [24, 28]
            }
        ],
        size: ["+", 30],
        fields: []
    }
];

