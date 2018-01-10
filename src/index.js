import React, { Component } from 'react'
import PropTypes from 'prop-types'
import ReactDOM from 'react-dom'
import * as D3 from 'd3'
import elementResize from 'element-resize-event'
import Json from './mock.js'
import './index.less'

const BOARD_HEIGHT = Math.max(document.body.clientHeight, document.documentElement.clientHeight)
const BOARD_WIDTH = Math.min(document.body.clientWidth, document.documentElement.clientWidth)

const CARD_HEIGHT = 150 
const CARD_WIDTH = 200
const CARD_OFFSET = 50

const severityToColor = {
  '0': 'recovery', // 恢复
  '1': 'warning', // 提醒
  '2': 'error', // 警告
  '3': 'critical'  // 紧急
}

class DragBoard extends Component {

  static propTypes = {
    width: PropTypes.number,
    height: PropTypes.number,
    dataSource: PropTypes.array.isRequired
  }

  constructor(props) {
    super(props)
    this.renderCard = this.renderCard.bind(this)
  }

  componentDidMount() {
    this.renderCard()
  }

  componentDidUpdate() {
    thi.renderCard()
  }

  clickBoard(node) {
    console.dir(node)
  }

  computeRectXY(board, rect, index) {
    // 先计算每行到底能放几个
    const rowcount = Math.floor((board.width - CARD_OFFSET) / (rect.width + CARD_OFFSET))
    const quotient = Math.floor(index / rowcount)
    const remainder = Math.floor(index % rowcount)

    return {
      x: (remainder + 1) * CARD_OFFSET + remainder * rect.width,
      y: (quotient + 1) * CARD_OFFSET + quotient * rect.height,
    }
  }

  renderCard() {
    const boardHeight = this.props.height || BOARD_HEIGHT
    const boardWidth = this.props.width || BOARD_WIDTH
    const dataSource = this.props.dataSource || []
    
    this.board = D3.select('#dragBoard')
      .append('svg:svg')
      .attr('height', boardHeight)
      .attr('width', boardWidth)

    dataSource.forEach((data, index) => {
      this.board.append('g:g')
        .attr('class', 'drag-board-card')
        .on('click', this.clickBoard.bind(this))
        .append('g:rect')
        .attr('x', node => {
          return (
            this.computeRectXY(
              { width: boardWidth, height: boardHeight },
              { width: CARD_WIDTH, height: CARD_HEIGHT },
              index
            ).x
          )
        })
        .attr('y', node => {
          return (
            this.computeRectXY(
              { width: boardWidth, height: boardHeight },
              { width: CARD_WIDTH, height: CARD_HEIGHT },
              index
            ).y
          )
        })
        .attr('rx', 10)
        .attr('ry', 10)
        .attr('class', severityToColor[data.severity])
        .attr('height', CARD_HEIGHT)
        .attr('width', CARD_WIDTH)
        .style('opacity', '0')
        .transition()
        .duration(2000)
        .style('opacity', '1')
    })
    console.log(D3.selectAll('.drag-board-card'))
    // 绑定拖动事件
    D3.selectAll('.drag-board-card')
      .call(this.dragCard())
  }

  dragCard() {
    const drag = D3.drag()
      .on('start', (d) => {
        console.log(d)
      })
      .on('drag', (d) => {
        console.log(d)
      })
      .on('end', (d) => {
        console.log(d)
      })
    return drag
  }

  render() {
    return (
      <div id="dragBoard" className='drag-board'></div>
    )
  }
}

const app = document.body.querySelector('#app')

ReactDOM.render(
  <DragBoard 
    width={1000}
    height={800}
    dataSource={Json}
  />,
app)